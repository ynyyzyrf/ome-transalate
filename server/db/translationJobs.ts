import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import {
  documents,
  translationJobs,
  type InsertTranslationJob,
  type TranslationJob,
} from "../../drizzle/schema";
import { getDb, getInsertId, withDb, DatabaseNotAvailableError } from "./index";

export async function createTranslationJob(data: InsertTranslationJob): Promise<number> {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  const result = await db.insert(translationJobs).values(data);
  return getInsertId(result);
}

export async function getTranslationJob(
  documentId: number,
  targetLanguage: string
): Promise<TranslationJob | undefined> {
  return withDb(async () => {
    const db = await getDb();
    const result = await db!
      .select()
      .from(translationJobs)
      .where(
        and(
          eq(translationJobs.documentId, documentId),
          eq(translationJobs.targetLanguage, targetLanguage)
        )
      )
      .limit(1);
    return result[0];
  });
}

export async function getTranslationJobById(id: number): Promise<TranslationJob | undefined> {
  return withDb(async () => {
    const db = await getDb();
    const result = await db!.select().from(translationJobs).where(eq(translationJobs.id, id)).limit(1);
    return result[0];
  });
}

export async function getTranslationJobsByDocument(documentId: number): Promise<TranslationJob[]> {
  return withDb(async () => {
    const db = await getDb();
    return db!.select().from(translationJobs).where(eq(translationJobs.documentId, documentId));
  });
}

export async function updateTranslationJobStatus(
  id: number,
  status: TranslationJob["status"],
  extra?: Partial<TranslationJob>
) {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  await db.update(translationJobs).set({ status, ...extra }).where(eq(translationJobs.id, id));
}

export async function listAllTranslationJobs(page = 1, pageSize = 30) {
  return withDb(async () => {
    const db = await getDb();
    const offset = (page - 1) * pageSize;
    const items = await db!
      .select({
        job: translationJobs,
        docTitle: documents.title,
      })
      .from(translationJobs)
      .leftJoin(documents, eq(translationJobs.documentId, documents.id))
      .orderBy(desc(translationJobs.createdAt))
      .limit(pageSize)
      .offset(offset);
    const countResult = await db!.select({ count: sql<number>`count(*)` }).from(translationJobs);
    return { items, total: countResult[0]?.count ?? 0 };
  });
}

// ─── Queue primitives (persistent translation queue) ─────────────────────────

/**
 * Release jobs that were claimed but never finished — either because the process
 * died mid-translation, or because a claim has no recorded timestamp. Used both
 * at server startup (staleAfterMs = 0 releases everything) and periodically by
 * the worker as a crash safety net.
 */
export async function resetStaleProcessingJobs(staleAfterMs: number, now = new Date()): Promise<void> {
  return withDb(async () => {
    const db = await getDb();
    const cutoff = new Date(now.getTime() - staleAfterMs);
    await db!
      .update(translationJobs)
      .set({ status: "pending", workerId: null, claimedAt: null })
      .where(
        and(
          eq(translationJobs.status, "processing"),
          or(isNull(translationJobs.claimedAt), lt(translationJobs.claimedAt, cutoff))
        )
      );
  });
}

/**
 * Atomically claim up to `limit` pending jobs for this worker. The claim is a
 * single UPDATE ... JOIN statement, so concurrent workers can never double-claim
 * the same job. Returns the claimed (now "processing") rows.
 */
export async function claimPendingTranslationJobs(
  workerId: string,
  limit: number,
  now = new Date()
): Promise<TranslationJob[]> {
  return withDb(async () => {
    const db = await getDb();
    await db!.execute(
      sql`UPDATE ${translationJobs} tj
          JOIN (SELECT id FROM ${translationJobs} WHERE status = 'pending' ORDER BY id LIMIT ${limit}) picked
            ON tj.id = picked.id
          SET tj.status = 'processing',
              tj.workerId = ${workerId},
              tj.claimedAt = ${now},
              tj.startedAt = COALESCE(tj.startedAt, ${now}),
              tj.attempts = tj.attempts + 1`
    );
    return db!
      .select()
      .from(translationJobs)
      .where(and(eq(translationJobs.status, "processing"), eq(translationJobs.workerId, workerId)))
      .orderBy(translationJobs.id);
  });
}

/**
 * Document ids whose status is still "processing" but whose translation jobs are
 * all in a terminal state (crashed before the final aggregation ran).
 */
export async function getDocumentIdsNeedingStatusRecompute(): Promise<number[]> {
  return withDb(async () => {
    const db = await getDb();
    const processingDocs = db!
      .select({ id: documents.id })
      .from(documents)
      .where(eq(documents.status, "processing"));
    const rows = await db!
      .selectDistinct({ documentId: translationJobs.documentId })
      .from(translationJobs)
      .where(
        and(
          inArray(translationJobs.status, ["completed", "failed"]),
          inArray(translationJobs.documentId, processingDocs)
        )
      );
    return rows.map((r: { documentId: number }) => r.documentId);
  });
}

/** Queue depth — number of jobs waiting to be picked up. */
export async function countPendingTranslationJobs(): Promise<number> {
  return withDb(async () => {
    const db = await getDb();
    const result = await db!
      .select({ count: sql<number>`count(*)` })
      .from(translationJobs)
      .where(eq(translationJobs.status, "pending"));
    return result[0]?.count ?? 0;
  });
}
