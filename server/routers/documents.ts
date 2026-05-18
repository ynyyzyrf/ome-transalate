/**
 * Documents Router
 * Handles document upload, management, and translation triggering.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  createDocument,
  createTranslationJob,
  deleteDocument,
  getDocumentById,
  getTranslationJob,
  getTranslationJobsByDocument,
  listDocuments,
  listPublishedDocuments,
  updateDocumentPublished,
  updateDocumentStatus,
  updateTranslationJobStatus,
  getGlossaryForLanguage,
} from "../db";
import { parseDocument, detectFileType } from "../documentParser";
import { translateSegments } from "../translationEngine";
import { storagePut } from "../storage";
import { SUPPORTED_LANGUAGES } from "../../drizzle/schema";

// Admin-only middleware
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "管理員權限才能執行此操作" });
  }
  return next({ ctx });
});

export const documentsRouter = router({
  // ── Admin: List all documents ──────────────────────────────────────────────
  list: adminProcedure
    .input(z.object({ page: z.number().min(1).default(1), pageSize: z.number().min(1).max(100).default(20) }))
    .query(async ({ input }) => {
      return listDocuments(input.page, input.pageSize);
    }),

  // ── Public: List published documents ──────────────────────────────────────
  listPublished: publicProcedure
    .input(z.object({ search: z.string().optional(), language: z.string().optional() }))
    .query(async ({ input }) => {
      return listPublishedDocuments(input.search, input.language);
    }),

  // ── Get single document ────────────────────────────────────────────────────
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const doc = await getDocumentById(input.id);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "文檔不存在" });
      return doc;
    }),

  // ── Get translation jobs for a document ───────────────────────────────────
  getTranslations: publicProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ input }) => {
      return getTranslationJobsByDocument(input.documentId);
    }),

  // ── Get specific translation ───────────────────────────────────────────────
  getTranslation: publicProcedure
    .input(z.object({ documentId: z.number(), language: z.string() }))
    .query(async ({ input }) => {
      const job = await getTranslationJob(input.documentId, input.language);
      return job ?? null;
    }),

  // ── Admin: Upload document (base64 encoded) ────────────────────────────────
  upload: adminProcedure
    .input(
      z.object({
        filename: z.string(),
        mimeType: z.string(),
        base64Content: z.string(),
        title: z.string().optional(),
        targetLanguages: z.array(z.string()).default(["en"]),
        // Course metadata
        category: z.string().max(128).optional(),
        instructor: z.string().max(256).optional(),
        description: z.string().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const buffer = Buffer.from(input.base64Content, "base64");
      const fileType = detectFileType(input.filename, input.mimeType);
      const title = input.title || input.filename.replace(/\.[^.]+$/, "");

      // Upload original file to S3
      const s3Key = `documents/original/${Date.now()}-${input.filename}`;
      const { url: s3Url } = await storagePut(s3Key, buffer, input.mimeType);

      // Parse document
      let extractedText = "";
      let segments: any[] = [];
      try {
        const parsed = await parseDocument(buffer, input.filename, input.mimeType);
        extractedText = parsed.extractedText;
        segments = parsed.segments;
      } catch (err) {
        console.error("[Upload] Parse failed:", err);
      }

      // Create document record
      const docId = await createDocument({
        title,
        originalFilename: input.filename,
        fileType,
        fileSize: buffer.length,
        s3Key,
        s3Url,
        extractedText,
        segments,
        status: "pending",
        uploadedBy: ctx.user.id,
        isPublished: "no",
        category: input.category,
        instructor: input.instructor,
        description: input.description,
        sortOrder: input.sortOrder ?? 0,
      });

      // Create translation jobs for each target language
      for (const lang of input.targetLanguages) {
        await createTranslationJob({
          documentId: docId,
          targetLanguage: lang,
          status: "pending",
        });
      }

      // Trigger translation asynchronously
      triggerTranslation(docId, input.targetLanguages, ctx.user.id).catch(console.error);

      return { success: true, documentId: docId };
    }),

  // ── Admin: Publish/unpublish document ─────────────────────────────────────
  setPublished: adminProcedure
    .input(z.object({ id: z.number(), isPublished: z.boolean() }))
    .mutation(async ({ input }) => {
      await updateDocumentPublished(input.id, input.isPublished ? "yes" : "no");
      return { success: true };
    }),

  // ── Admin: Delete document ─────────────────────────────────────────────────
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteDocument(input.id);
      return { success: true };
    }),

  // ── Admin: Retry failed translation ───────────────────────────────────────
  retryTranslation: adminProcedure
    .input(z.object({ documentId: z.number(), language: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const job = await getTranslationJob(input.documentId, input.language);
      if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "翻譯任務不存在" });

      await updateTranslationJobStatus(job.id, "pending", { errorMessage: null });
      triggerTranslation(input.documentId, [input.language], ctx.user.id).catch(console.error);
      return { success: true };
    }),
});

/**
 * Background translation trigger (non-blocking).
 */
async function triggerTranslation(
  documentId: number,
  targetLanguages: string[],
  _userId: number
) {
  const doc = await getDocumentById(documentId);
  if (!doc || !doc.segments || !Array.isArray(doc.segments)) {
    await updateDocumentStatus(documentId, "failed");
    return;
  }

  await updateDocumentStatus(documentId, "processing");

  for (const lang of targetLanguages) {
    const job = await getTranslationJob(documentId, lang);
    if (!job) continue;

    try {
      await updateTranslationJobStatus(job.id, "processing", { startedAt: new Date() });

      // Load glossary for this language (returns { sourceTerm, englishTerm, targetTerm })
      const glossary = await getGlossaryForLanguage(lang);

      // Translate segments
      const translatedSegments = await translateSegments(
        doc.segments ?? [],
        lang,
        glossary
      );

      // Build translated text document
      const translatedText = translatedSegments.map((s) => s.text).join("\n\n");
      const outputBuffer = Buffer.from(translatedText, "utf-8");
      const outputKey = `documents/translated/${documentId}/${lang}-${Date.now()}.txt`;
      const { url: outputUrl } = await storagePut(outputKey, outputBuffer, "text/plain");

      await updateTranslationJobStatus(job.id, "completed", {
        translatedSegments,
        outputS3Key: outputKey,
        outputS3Url: outputUrl,
        completedAt: new Date(),
      });
    } catch (err: any) {
      console.error(`[Translation] Failed for doc ${documentId} lang ${lang}:`, err);
      await updateTranslationJobStatus(job.id, "failed", {
        errorMessage: err.message || "翻譯失敗",
      });
    }
  }

  // Update document status based on all jobs
  const allJobs = await getTranslationJobsByDocument(documentId);
  const allDone = allJobs.every((j) => j.status === "completed" || j.status === "failed");
  const anySuccess = allJobs.some((j) => j.status === "completed");
  if (allDone) {
    await updateDocumentStatus(documentId, anySuccess ? "completed" : "failed");
  }
}
