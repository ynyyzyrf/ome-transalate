import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import {
  adminAccounts,
  documents,
  feedbacks,
  glossaryBatches,
  glossaryEntries,
  translationJobs,
  users,
  userProgress,
  exercises,
  exerciseAttempts,
  type AdminAccount,
  type Document,
  type Feedback,
  type GlossaryEntry,
  type InsertAdminAccount,
  type InsertDocument,
  type InsertFeedback,
  type InsertGlossaryEntry,
  type InsertTranslationJob,
  type TranslationJob,
  type UserProgress,
  type InsertUserProgress,
  type Exercise,
  type InsertExercise,
  type ExerciseAttempt,
  type InsertExerciseAttempt,
} from "../drizzle/schema";
import type { InsertUser } from "../drizzle/schema";
import { ENV } from "./_core/env";

// ─── Connection Pool ───────────────────────────────────────────────────────
let _pool: mysql.Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

export class DatabaseError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

export class DatabaseNotAvailableError extends DatabaseError {
  constructor() {
    super("Database is not available");
    this.name = "DatabaseNotAvailableError";
  }
}

function createPool(): mysql.Pool {
  const url = new URL(ENV.databaseUrl);
  const pool = mysql.createPool({
    host: url.hostname,
    port: Number(url.port) || 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    charset: "utf8mb4",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  });
  return pool;
}

export async function getPool(): Promise<mysql.Pool> {
  if (!_pool) {
    _pool = createPool();
    _db = drizzle(_pool);
  }
  return _pool;
}

export async function getDb() {
  if (!_db) {
    const pool = await getPool();
    _db = drizzle(pool);
  }
  return _db;
}

/**
 * Helper that wraps DB operations with consistent error handling.
 * Throws DatabaseNotAvailableError if DB is down.
 * Wraps unexpected errors in DatabaseError.
 */
export async function withDb<T>(fn: () => Promise<T>): Promise<T> {
  try {
    await getPool();
    if (!_db) throw new DatabaseNotAvailableError();
    return await fn();
  } catch (err) {
    if (err instanceof DatabaseError) throw err;
    // Check for connection-related errors
    if (err instanceof Error && (
      err.message?.includes("ECONNREFUSED") ||
      err.message?.includes("ETIMEDOUT") ||
      err.message?.includes("getaddrinfo") ||
      err.message?.includes("Pool is closed")
    )) {
      throw new DatabaseError("Database connection failed", err);
    }
    throw err; // Re-throw unexpected errors as-is
  }
}

/**
 * Check if database is reachable (used by health check).
 */
export async function pingDb(): Promise<boolean> {
  try {
    const pool = await getPool();
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch {
    return false;
  }
}

/**
 * Close the database pool (used during graceful shutdown).
 */
export async function closeDb(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
  }
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function updateUserLanguage(userId: number, language: string) {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  await db.update(users).set({ preferredLanguage: language }).where(eq(users.id, userId));
}

export async function listUsers(page = 1, pageSize = 30) {
  return withDb(async () => {
    const db = await getDb();
    const offset = (page - 1) * pageSize;
    const items = await db!
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        loginMethod: users.loginMethod,
        createdAt: users.createdAt,
        lastSignedIn: users.lastSignedIn,
      })
      .from(users)
      .orderBy(desc(users.lastSignedIn))
      .limit(pageSize)
      .offset(offset);
    const countResult = await db!.select({ count: sql<number>`count(*)` }).from(users);
    return { items, total: countResult[0]?.count ?? 0 };
  });
}

// ─── Local Auth (email + password) ─────────────────────────────────────────
export async function getUserByEmail(email: string) {
  return withDb(async () => {
    const db = await getDb();
    const result = await db!.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  });
}

export async function createLocalUser(data: {
  email: string;
  passwordHash: string;
  name?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  const result = await db.insert(users).values({
    email: data.email,
    passwordHash: data.passwordHash,
    name: data.name || null,
    loginMethod: "local",
    role: "user",
    preferredLanguage: "zh",
    openId: null,
  });
  return Number((result[0] as Record<string, unknown>).insertId) ?? 0;
}

export async function updatePassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

export async function updateUserLastSignedIn(userId: number) {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
}

export async function updateUserRole(userId: number, role: "admin" | "user") {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

// ─── Admin Accounts (後台帳號密碼登入) ────────────────────────────────────────
export async function getAdminByUsername(username: string): Promise<AdminAccount | undefined> {
  return withDb(async () => {
    const db = await getDb();
    const result = await db!.select().from(adminAccounts).where(eq(adminAccounts.username, username)).limit(1);
    return result[0];
  });
}

export async function getAdminById(id: number): Promise<AdminAccount | undefined> {
  return withDb(async () => {
    const db = await getDb();
    const result = await db!.select().from(adminAccounts).where(eq(adminAccounts.id, id)).limit(1);
    return result[0];
  });
}

export async function createAdminAccount(data: InsertAdminAccount): Promise<number> {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  const result = await db.insert(adminAccounts).values(data);
  return Number((result[0] as Record<string, unknown>).insertId) ?? 0;
}

export async function listAdminAccounts() {
  return withDb(async () => {
    const db = await getDb();
    return db!.select({
      id: adminAccounts.id,
      username: adminAccounts.username,
      displayName: adminAccounts.displayName,
      createdAt: adminAccounts.createdAt,
    }).from(adminAccounts).orderBy(adminAccounts.username);
  });
}

// ─── Documents / Courses ──────────────────────────────────────────────────────
export async function createDocument(data: InsertDocument): Promise<number> {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  const result = await db.insert(documents).values(data);
  return Number((result[0] as Record<string, unknown>).insertId) ?? 0;
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
      items: items.map((r) => ({ ...r.doc, feedbackCount: r.feedbackCount })),
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

    const translationDocIds = new Set(translationMatches.map((r) => r.documentId));
    const directDocIds = new Set(directMatches.map((d) => d.id));
    const extraIds = Array.from(translationDocIds).filter((id) => !directDocIds.has(id));
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
  await db.transaction(async (tx) => {
    await tx.delete(feedbacks).where(eq(feedbacks.tutorialId, id));
    await tx.delete(translationJobs).where(eq(translationJobs.documentId, id));
    await tx.delete(documents).where(eq(documents.id, id));
  });
}

// ─── Translation Jobs ─────────────────────────────────────────────────────────
export async function createTranslationJob(data: InsertTranslationJob): Promise<number> {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  const result = await db.insert(translationJobs).values(data);
  return Number((result[0] as Record<string, unknown>).insertId) ?? 0;
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

// ─── Glossary (多語言術語庫 — 以英文為基底) ──────────────────────────────────
export async function createGlossaryEntry(data: InsertGlossaryEntry): Promise<number> {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  const result = await db.insert(glossaryEntries).values(data);
  return Number((result[0] as Record<string, unknown>).insertId) ?? 0;
}

export async function bulkCreateGlossaryEntries(entries: InsertGlossaryEntry[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  if (!entries.length) return;
  await db.insert(glossaryEntries).values(entries);
}

export async function listGlossaryEntries(): Promise<GlossaryEntry[]> {
  return withDb(async () => {
    const db = await getDb();
    return db!.select().from(glossaryEntries).orderBy(glossaryEntries.sourceTerm);
  });
}

export async function deleteGlossaryEntry(id: number) {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  await db.delete(glossaryEntries).where(eq(glossaryEntries.id, id));
}

export async function createGlossaryBatch(data: {
  filename: string;
  s3Key: string;
  entriesCount: number;
  uploadedBy: number;
}) {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  await db.insert(glossaryBatches).values(data);
}

export async function listGlossaryBatches() {
  return withDb(async () => {
    const db = await getDb();
    return db!.select().from(glossaryBatches).orderBy(desc(glossaryBatches.createdAt));
  });
}

/**
 * Get glossary terms for a specific target language.
 * Returns array of { sourceTerm, targetTerm } for use in translation engine.
 */
export async function getGlossaryForLanguage(
  targetLanguage: string
): Promise<Array<{ sourceTerm: string; englishTerm: string; targetTerm: string }>> {
  return withDb(async () => {
    const db = await getDb();
    const entries = await db!.select().from(glossaryEntries);
    return entries
      .map((e) => {
        let targetTerm = e.englishTerm; // fallback to English
        if (targetLanguage === "es" && e.spanishTerm) targetTerm = e.spanishTerm;
        else if (targetLanguage === "th" && e.thaiTerm) targetTerm = e.thaiTerm;
        else if (targetLanguage === "hi" && e.hindiTerm) targetTerm = e.hindiTerm;
        else if (targetLanguage === "vi" && e.vietnameseTerm) targetTerm = e.vietnameseTerm;
        return { sourceTerm: e.sourceTerm, englishTerm: e.englishTerm, targetTerm };
      })
      .filter((e) => e.targetTerm);
  });
}

// ─── Feedbacks ────────────────────────────────────────────────────────────────
export async function createFeedback(data: InsertFeedback): Promise<number> {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  const result = await db.insert(feedbacks).values(data);
  return Number((result[0] as Record<string, unknown>).insertId) ?? 0;
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

// ─── User Progress (學習進度追蹤) ─────────────────────────────────────────────
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

// ─── Exercises (測驗) ─────────────────────────────────────────────────────────
export async function createExercise(data: InsertExercise): Promise<number> {
  const db = await getDb();
  if (!db) throw new DatabaseNotAvailableError();
  const result = await db.insert(exercises).values(data);
  return Number((result[0] as Record<string, unknown>).insertId) ?? 0;
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
  return Number((result[0] as Record<string, unknown>).insertId) ?? 0;
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
