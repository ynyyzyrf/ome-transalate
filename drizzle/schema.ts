import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
  bigint,
  index,
  uniqueIndex,
  tinyint,
} from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  // openId is for OAuth users; nullable for local auth users
  openId: varchar("openId", { length: 64 }),
  // passwordHash is for local email+password auth users; nullable for OAuth users
  passwordHash: varchar("passwordHash", { length: 256 }),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  preferredLanguage: varchar("preferredLanguage", { length: 16 }).default("zh").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Admin Sessions (後台帳號密碼登入) ────────────────────────────────────────
export const adminAccounts = mysqlTable("admin_accounts", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 256 }).notNull(),
  displayName: varchar("displayName", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AdminAccount = typeof adminAccounts.$inferSelect;
export type InsertAdminAccount = typeof adminAccounts.$inferInsert;

// ─── Documents (原始中文文檔) ─────────────────────────────────────────────────
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 512 }).notNull(),
  originalFilename: varchar("originalFilename", { length: 512 }).notNull(),
  fileType: mysqlEnum("fileType", ["pdf", "docx", "doc", "xlsx", "pptx", "vsdx", "xmind", "jpg", "png", "other"]).notNull(),
  fileSize: bigint("fileSize", { mode: "number" }).notNull(),
  s3Key: varchar("s3Key", { length: 1024 }).notNull(),
  s3Url: text("s3Url").notNull(),
  // Extracted plain text (for search and translation)
  extractedText: text("extractedText"),
  // Structured segments as JSON array: [{id, text, order}]
  segments: json("segments").$type<Segment[]>(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  uploadedBy: int("uploadedBy").notNull(),
  isPublished: mysqlEnum("isPublished", ["yes", "no"]).default("no").notNull(),
  // Additional metadata for course management
  category: varchar("category", { length: 128 }),
  instructor: varchar("instructor", { length: 256 }),
  description: text("description"),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

// ─── Translation Jobs (翻譯任務) ──────────────────────────────────────────────
export const translationJobs = mysqlTable(
  "translation_jobs",
  {
    id: int("id").autoincrement().primaryKey(),
    documentId: int("documentId").notNull(),
    targetLanguage: varchar("targetLanguage", { length: 16 }).notNull(), // en, es, th, hi, vi
    status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
    errorMessage: text("errorMessage"),
    // Translated segments as JSON: [{id, text}]
    translatedSegments: json("translatedSegments").$type<TranslatedSegment[]>(),
    // S3 key for reconstructed translated document
    outputS3Key: varchar("outputS3Key", { length: 1024 }),
    outputS3Url: text("outputS3Url"),
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_doc_lang").on(table.documentId, table.targetLanguage),
  ]
);

export type TranslationJob = typeof translationJobs.$inferSelect;
export type InsertTranslationJob = typeof translationJobs.$inferInsert;

// ─── Glossary Entries (多語言術語庫 — 以英文為基底) ───────────────────────────
// New structure: one row per Chinese term, with all target language translations
export const glossaryEntries = mysqlTable("glossary_entries", {
  id: int("id").autoincrement().primaryKey(),
  sourceTerm: varchar("sourceTerm", { length: 512 }).notNull(),   // 中文術語
  englishTerm: varchar("englishTerm", { length: 512 }).notNull(), // 英文（底層語言）
  spanishTerm: varchar("spanishTerm", { length: 512 }),           // 西班牙語
  thaiTerm: varchar("thaiTerm", { length: 512 }),                 // 泰文
  hindiTerm: varchar("hindiTerm", { length: 512 }),               // 印地語
  vietnameseTerm: varchar("vietnameseTerm", { length: 512 }),     // 越南文
  description: text("description"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GlossaryEntry = typeof glossaryEntries.$inferSelect;
export type InsertGlossaryEntry = typeof glossaryEntries.$inferInsert;

// ─── Glossary Upload Batches (術語庫批次上傳記錄) ─────────────────────────────
export const glossaryBatches = mysqlTable("glossary_batches", {
  id: int("id").autoincrement().primaryKey(),
  filename: varchar("filename", { length: 512 }).notNull(),
  s3Key: varchar("s3Key", { length: 1024 }).notNull(),
  entriesCount: int("entriesCount").default(0).notNull(),
  uploadedBy: int("uploadedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GlossaryBatch = typeof glossaryBatches.$inferSelect;

// ─── Feedbacks (用戶反饋) ─────────────────────────────────────────────────────
// status: 0=未接收, 1=處理中, 2=已處理
export const feedbacks = mysqlTable(
  "feedbacks",
  {
    id: int("id").autoincrement().primaryKey(),
    tutorialId: int("tutorialId").notNull(),       // 關聯 documents.id
    tutorialTitle: varchar("tutorialTitle", { length: 512 }).notNull(),
    userId: int("userId").notNull(),               // 關聯 users.id
    userName: varchar("userName", { length: 256 }), // 快照用戶名
    originalText: text("originalText").notNull(),  // 選取的中文原文
    translatedText: text("translatedText").notNull(), // 對應的翻譯文字
    targetLanguage: varchar("targetLanguage", { length: 16 }).notNull(),
    feedbackType: mysqlEnum("feedbackType", ["suggestion", "question"]).default("suggestion").notNull(),
    feedbackContent: text("feedbackContent").notNull(), // 用戶反饋意見
    status: tinyint("status").default(0).notNull(), // 0=未接收, 1=處理中, 2=已處理
    adminNote: text("adminNote"),                  // 管理員備注
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_feedback_tutorial").on(table.tutorialId),
    index("idx_feedback_user").on(table.userId),
    index("idx_feedback_status").on(table.status),
  ]
);

export type Feedback = typeof feedbacks.$inferSelect;
export type InsertFeedback = typeof feedbacks.$inferInsert;

// ─── User Progress (學習進度追蹤) ─────────────────────────────────────────────
export const userProgress = mysqlTable(
  "user_progress",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    documentId: int("documentId").notNull(),
    lastSegmentId: varchar("lastSegmentId", { length: 64 }),
    completedSegments: json("completedSegments").$type<string[]>().default([]),
    status: mysqlEnum("status", ["not_started", "in_progress", "completed"]).default("not_started").notNull(),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("unq_progress_user_doc").on(table.userId, table.documentId),
    index("idx_progress_user_doc").on(table.userId, table.documentId),
  ]
);

export type UserProgress = typeof userProgress.$inferSelect;
export type InsertUserProgress = typeof userProgress.$inferInsert;

// ─── Exercises (測驗) ─────────────────────────────────────────────────────────
export const exercises = mysqlTable(
  "exercises",
  {
    id: int("id").autoincrement().primaryKey(),
    documentId: int("documentId").notNull(),
    segmentId: varchar("segmentId", { length: 64 }),
    question: text("question").notNull(),
    options: json("options").$type<string[]>().default([]),
    correctAnswer: varchar("correctAnswer", { length: 512 }).notNull(),
    type: mysqlEnum("type", ["choice", "true_false", "fill"]).default("choice").notNull(),
    order: int("order").default(0).notNull(),
    createdBy: int("createdBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("idx_exercise_doc").on(table.documentId),
  ]
);

export type Exercise = typeof exercises.$inferSelect;
export type InsertExercise = typeof exercises.$inferInsert;

// ─── Exercise Attempts (答題記錄) ─────────────────────────────────────────────
export const exerciseAttempts = mysqlTable(
  "exercise_attempts",
  {
    id: int("id").autoincrement().primaryKey(),
    exerciseId: int("exerciseId").notNull(),
    userId: int("userId").notNull(),
    answer: text("answer").notNull(),
    isCorrect: tinyint("isCorrect").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    index("idx_attempt_user_exercise").on(table.userId, table.exerciseId),
  ]
);

export type ExerciseAttempt = typeof exerciseAttempts.$inferSelect;
export type InsertExerciseAttempt = typeof exerciseAttempts.$inferInsert;

// ─── Shared TypeScript types ──────────────────────────────────────────────────
export interface Segment {
  id: string;      // e.g. "seg-001"
  text: string;
  order: number;
  type?: "heading" | "paragraph" | "list" | "table" | "other";
}

export interface TranslatedSegment {
  id: string;      // matches Segment.id
  text: string;
}

export const SUPPORTED_LANGUAGES = ["en", "es", "th", "hi", "vi"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<string, string> = {
  zh: "中文",
  en: "English",
  es: "Español",
  th: "ภาษาไทย",
  hi: "हिन्दी",
  vi: "Tiếng Việt",
};

// Feedback status constants
export const FEEDBACK_STATUS = {
  PENDING: 0,
  PROCESSING: 1,
  RESOLVED: 2,
} as const;

export const FEEDBACK_STATUS_LABELS: Record<number, string> = {
  0: "未接收",
  1: "處理中",
  2: "已處理",
};
