/**
 * Compatibility barrel — re-exports all domain-specific data access modules.
 *
 * New code should import directly from the domain modules:
 *   import { getDocumentById } from "./db/documents";
 *   import { listUsers } from "./db/users";
 *
 * This barrel exists so that existing `import * as db from "./db"` and
 * `import { foo } from "./db"` patterns continue to work during the migration.
 */
export {
  DatabaseError,
  DatabaseNotAvailableError,
  closeDb,
  getDb,
  getInsertId,
  getPool,
  pingDb,
  withDb,
} from "./db/index";

export {
  createDocument,
  deleteDocument,
  getDocumentById,
  listDocuments,
  listPublishedDocuments,
  updateDocumentMeta,
  updateDocumentPublished,
  updateDocumentStatus,
} from "./db/documents";

export {
  claimPendingTranslationJobs,
  countPendingTranslationJobs,
  createTranslationJob,
  getDocumentIdsNeedingStatusRecompute,
  getTranslationJob,
  getTranslationJobById,
  getTranslationJobsByDocument,
  listAllTranslationJobs,
  resetStaleProcessingJobs,
  updateTranslationJobStatus,
} from "./db/translationJobs";

export {
  bulkCreateGlossaryEntries,
  createGlossaryBatch,
  createGlossaryEntry,
  deleteGlossaryEntry,
  getGlossaryForLanguage,
  listGlossaryBatches,
  listGlossaryEntries,
} from "./db/glossary";

export {
  createFeedback,
  getFeedbackById,
  getFeedbacksByUser,
  listAllFeedbacks,
  updateFeedbackStatus,
} from "./db/feedbacks";

export {
  createLocalUser,
  getUserByEmail,
  getUserById,
  getUserByOpenId,
  listUsers,
  updatePassword,
  updateUserLanguage,
  updateUserLastSignedIn,
  updateUserRole,
  upsertUser,
} from "./db/users";

export {
  createAdminAccount,
  getAdminById,
  getAdminByUsername,
  listAdminAccounts,
} from "./db/admins";

export {
  getProgress,
  listUserProgress,
  upsertProgress,
} from "./db/progress";

export {
  createExercise,
  createExerciseAttempt,
  deleteExercise,
  getExerciseAttempts,
  getExercisesByDocument,
} from "./db/exercises";
