import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import {
  documents,
  feedbacks,
  translationJobs,
  type Document,
  type InsertDocument,
} from "../../drizzle/schema";
import { getDb, getInsertId, withDb, DatabaseNotAvailableError } from "./index";

export async function createDocument(data: InsertDocument): Promise<number> {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  const result = await db.insert(documents).values(data);
  return getInsertId(result);
}

export async function getDocumentById(id: number): Promise<Document | undefined> {
  return withDb(async () => {
    const db = await getDb();
    const result = await db!.select().from(documents).where(eq(documents.id, id)).limit(1);
    return result[0];
  });
}

export async function listDocuments(page = 1, pageSize = 20) {
  return withDb(async () => {
    const db = await getDb();
    const offset = (page - 1) * pageSize;
    const items = await db!
      .select({
        doc: documents,
        feedbackCount: sql<number>`COUNT(${feedbacks.id})`,
      })
      .from(documents)
      .leftJoin(feedbacks, eq(feedbacks.tutorialId, documents.id))
      .groupBy(documents.id)
      .orderBy(desc(documents.createdAt))
      .limit(pageSize)
      .offset(offset);
    const countResult = await db!.select({ count: sql<number>`count(*)` }).from(documents);
    return {
      items: items.map((r: any) => ({ ...r.doc, feedbackCount: r.feedbackCount })),
      total: countResult[0]?.count ?? 0,
    };
  });
}

export async function listPublishedDocuments(search?: string, language?: string) {
  return withDb(async () => {
    const db = await getDb();

    if (!search) {
      return db!
        .select()
        .from(documents)
        .where(eq(documents.isPublished, "yes"))
        .orderBy(documents.sortOrder, desc(documents.createdAt));
    }

    const directMatches = await db!
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.isPublished, "yes"),
          or(
            like(documents.title, `%${search}%`),
            like(documents.extractedText, `%${search}%`)
          )
        )
      )
      .orderBy(documents.sortOrder, desc(documents.createdAt));

    const translationMatches = await db!
      .select({ documentId: translationJobs.documentId })
      .from(translationJobs)
      .where(
        and(
          eq(translationJobs.status, "completed"),
          sql`JSON_SEARCH(${translationJobs.translatedSegments}, 'one', ${`%${search}%`}, NULL, '$[*].text') IS NOT NULL`
        )
      );

    const translationDocIds = new Set<number>(translationMatches.map((r: any) => Number(r.documentId)));
    const directDocIds = new Set<number>(directMatches.map((d: any) => Number(d.id)));
    const extraIds: number[] = Array.from(translationDocIds).filter((id) => !directDocIds.has(id));
    let extraDocs: Document[] = [];
    if (extraIds.length > 0) {
      extraDocs = await db!
        .select()
        .from(documents)
        .where(and(eq(documents.isPublished, "yes"), inArray(documents.id, extraIds)))
        .orderBy(documents.sortOrder, desc(documents.createdAt));
    }

    return [...directMatches, ...extraDocs];
  });
}

export async function updateDocumentStatus(
  id: number,
  status: Document["status"],
  extra?: Partial<Document>
) {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  await db.update(documents).set({ status, ...extra }).where(eq(documents.id, id));
}

export async function updateDocumentPublished(id: number, isPublished: "yes" | "no") {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  await db.update(documents).set({ isPublished }).where(eq(documents.id, id));
}

export async function updateDocumentMeta(
  id: number,
  data: {
    title?: string;
    instructor?: string;
    category?: string;
    description?: string;
    sortOrder?: number;
    isPublished?: "yes" | "no";
    extractedText?: string;
    segments?: any;
  }
) {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  await db.update(documents).set(data).where(eq(documents.id, id));
}

export async function deleteDocument(id: number) {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  // Use transaction for multi-table delete consistency
  await db.transaction(async (tx: any) => {
    await tx.delete(feedbacks).where(eq(feedbacks.tutorialId, id));
    await tx.delete(translationJobs).where(eq(translationJobs.documentId, id));
    await tx.delete(documents).where(eq(documents.id, id));
  });
}
