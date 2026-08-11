import { randomUUID } from "node:crypto";
import { getDocumentById, updateDocumentStatus } from "../db/documents";
import { getGlossaryForLanguage } from "../db/glossary";
import {
  claimPendingTranslationJobs,
  getDocumentIdsNeedingStatusRecompute,
  getTranslationJobById,
  getTranslationJobsByDocument,
  resetStaleProcessingJobs,
  updateTranslationJobStatus,
} from "../db/translationJobs";
import { blocksToTranslatedSegments, segmentsToIR } from "../documentIr";
import { renderTranslationPreviewHtml } from "../previewHtml";
import { storagePut } from "../storage";
import { translateBlocks } from "../translationEngine";

// ─── Configuration ───────────────────────────────────────────────────────────
/** A claim older than this is considered dead (worker crashed mid-job). */
const STALE_CLAIM_MS = 10 * 60 * 1000;
const POLL_INTERVAL_MS = 3000;
const DEFAULT_CONCURRENCY = 3;

// ─── Worker lifecycle state ──────────────────────────────────────────────────
/** Unique per-process id so claims are attributable and recoverable. */
const workerId = `worker-${process.pid}-${randomUUID().slice(0, 8)}`;
let timer: NodeJS.Timeout | null = null;
let running = false;

/**
 * In-process persistent queue worker. Picks up "pending" translation jobs from
 * the translation_jobs table (claimed atomically so multiple instances could
 * share the queue), translates each job, and recomputes the document status.
 *
 * Jobs survive process restarts: statuses live in MySQL, and
 * `recoverStuckTranslationJobs()` (called at boot) returns any job left in
 * "processing" back to the queue.
 */
export function startTranslationWorker(opts?: {
  pollIntervalMs?: number;
  concurrency?: number;
}): void {
  if (timer) return; // idempotent

  const pollIntervalMs = opts?.pollIntervalMs ?? POLL_INTERVAL_MS;
  const concurrency = opts?.concurrency ?? DEFAULT_CONCURRENCY;

  const tick = async () => {
    try {
      await processDueJobs(concurrency);
    } catch (err) {
      console.error("[Queue] worker tick failed:", err);
    }
  };

  timer = setInterval(tick, pollIntervalMs);
  // Don't keep the Node process alive purely for the worker.
  timer.unref?.();
  // Kick an immediate pass so newly enqueued jobs start without waiting.
  void tick();
}

export function stopTranslationWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/**
 * Wake the worker after jobs are created or reset (create/upload/retry paths).
 * The `running` guard means a concurrent pass is never duplicated; if a pass is
 * already in flight, the next poll interval will pick up the new jobs.
 */
export function kickTranslationWorker(): void {
  void processDueJobs().catch((err) => {
    console.error("[Queue] kick failed:", err);
  });
}

/**
 * One worker pass: release stale claims, claim a batch, translate them
 * sequentially (matching the original per-language sequential behavior),
 * then recompute each affected document's status.
 */
export async function processDueJobs(concurrency = DEFAULT_CONCURRENCY): Promise<void> {
  if (running) return;
  running = true;
  try {
    await resetStaleProcessingJobs(STALE_CLAIM_MS);
    const claimed = await claimPendingTranslationJobs(workerId, concurrency);
    if (claimed.length === 0) return;

    console.log(
      `[Queue] claimed ${claimed.length} job(s): ${claimed
        .map((j) => `#${j.id} (doc ${j.documentId}/${j.targetLanguage})`)
        .join(", ")}`
    );

    for (const job of claimed) {
      await processTranslationJob(job.id);
    }
  } finally {
    running = false;
  }
}

/**
 * Translate a single job (source → target language), store the preview HTML,
 * and mark the job completed / failed. Then recompute the parent document's
 * aggregate status. Mirrors the logic previously inside
 * `triggerTranslationForDocument`.
 */
export async function processTranslationJob(jobId: number): Promise<void> {
  const job = await getTranslationJobById(jobId);
  if (!job) return;

  const doc = await getDocumentById(job.documentId);
  if (!doc || !doc.segments || !Array.isArray(doc.segments)) {
    await updateDocumentStatus(job.documentId, "failed");
    await updateTranslationJobStatus(job.id, "failed", {
      errorMessage: "Document segments unavailable",
    });
    await recomputeDocumentStatus(job.documentId);
    return;
  }

  await updateDocumentStatus(job.documentId, "processing");
  const sourceBlocks = segmentsToIR((doc.segments as any) || [], "zh").blocks;

  try {
    const glossary = await getGlossaryForLanguage(job.targetLanguage);
    const translatedBlocks = await translateBlocks(sourceBlocks, job.targetLanguage, glossary);
    const translatedSegments = blocksToTranslatedSegments(translatedBlocks);
    const translatedTextBlocks = translatedBlocks.filter((block) => block.type !== "image");
    const nonEmptyTranslatedCount = translatedTextBlocks.filter(
      (block) => (block.text || "").trim().length > 0
    ).length;

    if (translatedTextBlocks.length > 0 && nonEmptyTranslatedCount === 0) {
      throw new Error("Translation output is empty");
    }

    const previewHtml = renderTranslationPreviewHtml({
      title: doc.title,
      language: job.targetLanguage,
      sourceBlocks,
      translatedBlocks,
    });
    const outputKey = `documents/preview/${job.documentId}/${job.targetLanguage}-${Date.now()}.html`;
    const { url: outputUrl } = await storagePut(
      outputKey,
      Buffer.from(previewHtml, "utf-8"),
      "text/html"
    );

    await updateTranslationJobStatus(job.id, "completed", {
      translatedSegments,
      outputS3Key: outputKey,
      outputS3Url: outputUrl,
      completedAt: new Date(),
    });
  } catch (err: any) {
    console.error(
      `[Queue] Translation failed for doc ${job.documentId} lang ${job.targetLanguage}:`,
      err
    );
    await updateTranslationJobStatus(job.id, "failed", {
      errorMessage: err.message || "Translation failed",
    });
  }

  await recomputeDocumentStatus(job.documentId);
}

/**
 * Aggregate a document's status from all of its translation jobs.
 * `completed` only when at least one job succeeded; `failed` when all jobs
 * finished unsuccessfully. Docs with any job still running stay "processing".
 */
async function recomputeDocumentStatus(documentId: number): Promise<void> {
  const allJobs = await getTranslationJobsByDocument(documentId);
  const allDone = allJobs.every((job) => job.status === "completed" || job.status === "failed");
  const anySuccess = allJobs.some((job) => job.status === "completed");
  if (allDone) {
    await updateDocumentStatus(documentId, anySuccess ? "completed" : "failed");
  }
}

/**
 * Startup self-healing (call once before the worker starts):
 * 1. Release every job stuck in "processing" back to the queue — at boot no
 *    worker owns anything, so all in-flight claims are by definition stale.
 *    (Single-instance assumption; multi-instance deployments should use a
 *    lease threshold instead of resetting everything.)
 * 2. Fix documents still marked "processing" whose jobs are all terminal —
 *    the final aggregation may not have run if the process died mid-batch.
 */
export async function recoverStuckTranslationJobs(): Promise<void> {
  await resetStaleProcessingJobs(0);
  const docIds = await getDocumentIdsNeedingStatusRecompute();
  for (const documentId of docIds) {
    await recomputeDocumentStatus(documentId);
  }
  if (docIds.length > 0) {
    console.log(`[Queue] Recovered document status for: ${docIds.join(", ")}`);
  }
}
