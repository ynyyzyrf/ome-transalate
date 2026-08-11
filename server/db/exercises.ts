import { and, eq } from "drizzle-orm";
import {
  exercises,
  exerciseAttempts,
  type Exercise,
  type InsertExercise,
  type ExerciseAttempt,
  type InsertExerciseAttempt,
} from "../../drizzle/schema";
import { getDb, getInsertId, withDb, DatabaseNotAvailableError } from "./index";

export async function createExercise(data: InsertExercise): Promise<number> {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  const result = await db.insert(exercises).values(data);
  return getInsertId(result);
}

export async function getExercisesByDocument(documentId: number): Promise<Exercise[]> {
  return withDb(async () => {
    const db = await getDb();
    return db!
      .select()
      .from(exercises)
      .where(eq(exercises.documentId, documentId))
      .orderBy(exercises.order);
  });
}

export async function createExerciseAttempt(data: InsertExerciseAttempt): Promise<number> {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  const result = await db.insert(exerciseAttempts).values(data);
  return getInsertId(result);
}

export async function getExerciseAttempts(
  userId: number,
  exerciseId: number
): Promise<ExerciseAttempt[]> {
  return withDb(async () => {
    const db = await getDb();
    return db!
      .select()
      .from(exerciseAttempts)
      .where(and(eq(exerciseAttempts.userId, userId), eq(exerciseAttempts.exerciseId, exerciseId)));
  });
}

export async function deleteExercise(id: number) {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  await db.delete(exercises).where(eq(exercises.id, id));
}
