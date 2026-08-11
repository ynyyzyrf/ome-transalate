import { and, desc, eq, sql } from "drizzle-orm";
import {
  feedbacks,
  type Feedback,
  type InsertFeedback,
} from "../../drizzle/schema";
import { getDb, getInsertId, withDb, DatabaseNotAvailableError } from "./index";

export async function createFeedback(data: InsertFeedback): Promise<number> {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  const result = await db.insert(feedbacks).values(data);
  return getInsertId(result);
}

export async function getFeedbacksByUser(userId: number, tutorialId?: number): Promise<Feedback[]> {
  return withDb(async () => {
    const db = await getDb();
    if (tutorialId) {
      return db!
        .select()
        .from(feedbacks)
        .where(and(eq(feedbacks.userId, userId), eq(feedbacks.tutorialId, tutorialId)))
        .orderBy(desc(feedbacks.createdAt));
    }
    return db!.select().from(feedbacks).where(eq(feedbacks.userId, userId)).orderBy(desc(feedbacks.createdAt));
  });
}

export async function listAllFeedbacks(opts: {
  page?: number;
  pageSize?: number;
  tutorialId?: number;
  status?: number;
}) {
  return withDb(async () => {
    const db = await getDb();
    const { page = 1, pageSize = 30, tutorialId, status } = opts;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (tutorialId !== undefined) conditions.push(eq(feedbacks.tutorialId, tutorialId));
    if (status !== undefined) conditions.push(eq(feedbacks.status, status));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db!
      .select()
      .from(feedbacks)
      .where(whereClause)
      .orderBy(desc(feedbacks.createdAt))
      .limit(pageSize)
      .offset(offset);

    const countResult = await db!
      .select({ count: sql<number>`count(*)` })
      .from(feedbacks)
      .where(whereClause);

    return { items, total: countResult[0]?.count ?? 0 };
  });
}

export async function updateFeedbackStatus(id: number, status: number, adminNote?: string) {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  const updateData: Record<string, unknown> = { status };
  if (adminNote !== undefined) updateData.adminNote = adminNote;
  await db.update(feedbacks).set(updateData).where(eq(feedbacks.id, id));
}

export async function getFeedbackById(id: number): Promise<Feedback | undefined> {
  return withDb(async () => {
    const db = await getDb();
    const result = await db!.select().from(feedbacks).where(eq(feedbacks.id, id)).limit(1);
    return result[0];
  });
}
