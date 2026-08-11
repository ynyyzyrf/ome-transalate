import { and, eq } from "drizzle-orm";
import {
  userProgress,
  type UserProgress,
  type InsertUserProgress,
} from "../../drizzle/schema";
import { getDb, withDb, DatabaseNotAvailableError } from "./index";

export async function getProgress(userId: number, documentId: number): Promise<UserProgress | undefined> {
  return withDb(async () => {
    const db = await getDb();
    const result = await db!
      .select()
      .from(userProgress)
      .where(and(eq(userProgress.userId, userId), eq(userProgress.documentId, documentId)))
      .limit(1);
    return result[0];
  });
}

export async function upsertProgress(data: InsertUserProgress): Promise<void> {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  await db.insert(userProgress).values(data).onDuplicateKeyUpdate({
    set: {
      lastSegmentId: data.lastSegmentId,
      completedSegments: data.completedSegments,
      status: data.status,
      completedAt: data.completedAt,
    },
  });
}

export async function listUserProgress(userId: number): Promise<UserProgress[]> {
  return withDb(async () => {
    const db = await getDb();
    return db!.select().from(userProgress).where(eq(userProgress.userId, userId));
  });
}
