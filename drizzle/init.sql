-- ============================================================
-- ome-translate / ome-transalate — production DB initializer
-- Generated from drizzle migrations tracked in
--   drizzle/meta/_journal.json (idx 0..3)
-- Plus a seeded admin row matching the salt+scrypt layout
-- used by server/routers/dashboard.ts.
--
-- Safe to re-run: every CREATE TABLE uses IF NOT EXISTS
-- and every ALTER is idempotent or wrapped to skip if exists.
-- Run from inside `mysql>` prompt after `USE zeabur;`.
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

-- ─── 0000_chunky_black_bolt ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `users` (
  `id` int AUTO_INCREMENT NOT NULL,
  `openId` varchar(64),
  `name` text,
  `email` varchar(320),
  `loginMethod` varchar(64),
  `role` enum('user','admin') NOT NULL DEFAULT 'user',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);
-- 0000 declares `openId` as unique; create it only when missing.
SET @uniq_idx := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name   = 'users'
    AND index_name   = 'users_openId_unique'
);
SET @sql := IF(@uniq_idx = 0,
  'ALTER TABLE `users` ADD CONSTRAINT `users_openId_unique` UNIQUE (`openId`)',
  'SELECT "users_openId_unique already exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─── 0001_many_stranger ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `documents` (
  `id` int AUTO_INCREMENT NOT NULL,
  `title` varchar(512) NOT NULL,
  `originalFilename` varchar(512) NOT NULL,
  `fileType` enum('pdf','docx','doc','xlsx','pptx','vsdx','xmind','jpg','png','other') NOT NULL,
  `fileSize` bigint NOT NULL,
  `s3Key` varchar(1024) NOT NULL,
  `s3Url` text NOT NULL,
  `extractedText` text,
  `segments` json,
  `status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
  `uploadedBy` int NOT NULL,
  `isPublished` enum('yes','no') NOT NULL DEFAULT 'no',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `glossary_batches` (
  `id` int AUTO_INCREMENT NOT NULL,
  `filename` varchar(512) NOT NULL,
  `s3Key` varchar(1024) NOT NULL,
  `entriesCount` int NOT NULL DEFAULT 0,
  `targetLanguage` varchar(16) NOT NULL,
  `uploadedBy` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `glossary_entries` (
  `id` int AUTO_INCREMENT NOT NULL,
  `sourceTerm` varchar(512) NOT NULL,
  `targetLanguage` varchar(16) NOT NULL,
  `targetTerm` varchar(512) NOT NULL,
  `description` text,
  `createdBy` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `translation_jobs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `documentId` int NOT NULL,
  `targetLanguage` varchar(16) NOT NULL,
  `status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
  `errorMessage` text,
  `translatedSegments` json,
  `outputS3Key` varchar(1024),
  `outputS3Url` text,
  `startedAt` timestamp NULL,
  `completedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

-- add preferredLanguage only if missing
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'preferredLanguage'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `preferredLanguage` varchar(16) NOT NULL DEFAULT ''zh''',
  'SELECT "preferredLanguage already exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- idx_doc_lang
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'translation_jobs' AND index_name = 'idx_doc_lang'
);
SET @sql := IF(@idx_exists = 0,
  'CREATE INDEX `idx_doc_lang` ON `translation_jobs` (`documentId`,`targetLanguage`)',
  'SELECT "idx_doc_lang already exists"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─── 0002_serious_chimera ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `admin_accounts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `username` varchar(64) NOT NULL,
  `passwordHash` varchar(256) NOT NULL,
  `displayName` varchar(128),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `admin_accounts_username_unique` (`username`)
);

CREATE TABLE IF NOT EXISTS `feedbacks` (
  `id` int AUTO_INCREMENT NOT NULL,
  `tutorialId` int NOT NULL,
  `tutorialTitle` varchar(512) NOT NULL,
  `userId` int NOT NULL,
  `userName` varchar(256),
  `originalText` text NOT NULL,
  `translatedText` text NOT NULL,
  `targetLanguage` varchar(16) NOT NULL,
  `feedbackType` enum('suggestion','question') NOT NULL DEFAULT 'suggestion',
  `feedbackContent` text NOT NULL,
  `status` tinyint NOT NULL DEFAULT 0,
  `adminNote` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

-- 0002 ALTERs on `documents` and `glossary_entries` — guarded with information_schema
-- add `category` on documents
SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'documents' AND column_name = 'category');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `documents` ADD COLUMN `category` varchar(128)', 'SELECT "documents.category ok"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- add `instructor` on documents
SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'documents' AND column_name = 'instructor');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `documents` ADD COLUMN `instructor` varchar(256)', 'SELECT "documents.instructor ok"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- add `description` on documents
SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'documents' AND column_name = 'description');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `documents` ADD COLUMN `description` text', 'SELECT "documents.description ok"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- add `sortOrder` on documents
SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'documents' AND column_name = 'sortOrder');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `documents` ADD COLUMN `sortOrder` int NOT NULL DEFAULT 0', 'SELECT "documents.sortOrder ok"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- add `englishTerm` on glossary_entries
SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'glossary_entries' AND column_name = 'englishTerm');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `glossary_entries` ADD COLUMN `englishTerm` varchar(512) NOT NULL DEFAULT ''''''', 'SELECT "glossary_entries.englishTerm ok"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- add `spanishTerm` on glossary_entries
SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'glossary_entries' AND column_name = 'spanishTerm');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `glossary_entries` ADD COLUMN `spanishTerm` varchar(512)', 'SELECT "glossary_entries.spanishTerm ok"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- add `thaiTerm` on glossary_entries
SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'glossary_entries' AND column_name = 'thaiTerm');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `glossary_entries` ADD COLUMN `thaiTerm` varchar(512)', 'SELECT "glossary_entries.thaiTerm ok"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- add `hindiTerm` on glossary_entries
SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'glossary_entries' AND column_name = 'hindiTerm');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `glossary_entries` ADD COLUMN `hindiTerm` varchar(512)', 'SELECT "glossary_entries.hindiTerm ok"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- add `vietnameseTerm` on glossary_entries
SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'glossary_entries' AND column_name = 'vietnameseTerm');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `glossary_entries` ADD COLUMN `vietnameseTerm` varchar(512)', 'SELECT "glossary_entries.vietnameseTerm ok"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- idx_feedback_tutorial / _user / _status
SET @idx_exists := (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'feedbacks' AND index_name = 'idx_feedback_tutorial');
SET @sql := IF(@idx_exists = 0, 'CREATE INDEX `idx_feedback_tutorial` ON `feedbacks` (`tutorialId`)', 'SELECT "idx_feedback_tutorial ok"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'feedbacks' AND index_name = 'idx_feedback_user');
SET @sql := IF(@idx_exists = 0, 'CREATE INDEX `idx_feedback_user` ON `feedbacks` (`userId`)', 'SELECT "idx_feedback_user ok"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'feedbacks' AND index_name = 'idx_feedback_status');
SET @sql := IF(@idx_exists = 0, 'CREATE INDEX `idx_feedback_status` ON `feedbacks` (`status`)', 'SELECT "idx_feedback_status ok"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 0002 drops `targetLanguage` and `targetTerm` from glossary tables — only run if they still exist
SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'glossary_batches' AND column_name = 'targetLanguage');
SET @sql := IF(@col_exists = 1, 'ALTER TABLE `glossary_batches` DROP COLUMN `targetLanguage`', 'SELECT "glossary_batches.targetLanguage already dropped"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'glossary_entries' AND column_name = 'targetLanguage');
SET @sql := IF(@col_exists = 1, 'ALTER TABLE `glossary_entries` DROP COLUMN `targetLanguage`', 'SELECT "glossary_entries.targetLanguage already dropped"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'glossary_entries' AND column_name = 'targetTerm');
SET @sql := IF(@col_exists = 1, 'ALTER TABLE `glossary_entries` DROP COLUMN `targetTerm`', 'SELECT "glossary_entries.targetTerm already dropped"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─── 0003_overrated_lizard ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `exercise_attempts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `exerciseId` int NOT NULL,
  `userId` int NOT NULL,
  `answer` text NOT NULL,
  `isCorrect` tinyint NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `exercises` (
  `id` int AUTO_INCREMENT NOT NULL,
  `documentId` int NOT NULL,
  `segmentId` varchar(64),
  `question` text NOT NULL,
  `options` json,
  `correctAnswer` varchar(512) NOT NULL,
  `type` enum('choice','true_false','fill') NOT NULL DEFAULT 'choice',
  `order` int NOT NULL DEFAULT 0,
  `createdBy` int,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `user_progress` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `documentId` int NOT NULL,
  `lastSegmentId` varchar(64),
  `completedSegments` json,
  `status` enum('not_started','in_progress','completed') NOT NULL DEFAULT 'not_started',
  `completedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unq_progress_user_doc` (`userId`,`documentId`)
);

-- 0003 drops the unique index on openId (we made it nullable)
SET @idx_exists := (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'users_openId_unique');
SET @sql := IF(@idx_exists = 1, 'ALTER TABLE `users` DROP INDEX `users_openId_unique`', 'SELECT "users_openId_unique already dropped"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 0003 expands the documents.fileType enum
ALTER TABLE `documents` MODIFY COLUMN `fileType` enum('pdf','docx','doc','xlsx','pptx','vsdx','xmind','jpg','png','other') NOT NULL;

-- 0003 makes users.openId nullable
ALTER TABLE `users` MODIFY COLUMN `openId` varchar(64) NULL;

-- 0003 adds users.passwordHash
SET @col_exists := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'passwordHash');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE `users` ADD COLUMN `passwordHash` varchar(256) NULL AFTER `openId`', 'SELECT "users.passwordHash ok"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 0003 indexes
SET @idx_exists := (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'exercise_attempts' AND index_name = 'idx_attempt_user_exercise');
SET @sql := IF(@idx_exists = 0, 'CREATE INDEX `idx_attempt_user_exercise` ON `exercise_attempts` (`userId`,`exerciseId`)', 'SELECT "idx_attempt_user_exercise ok"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'exercises' AND index_name = 'idx_exercise_doc');
SET @sql := IF(@idx_exists = 0, 'CREATE INDEX `idx_exercise_doc` ON `exercises` (`documentId`)', 'SELECT "idx_exercise_doc ok"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'user_progress' AND index_name = 'idx_progress_user_doc');
SET @sql := IF(@idx_exists = 0, 'CREATE INDEX `idx_progress_user_doc` ON `user_progress` (`userId`,`documentId`)', 'SELECT "idx_progress_user_doc ok"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 0003 adds unique index on users.email (re-create if missing)
SET @idx_exists := (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'idx_users_email');
SET @sql := IF(@idx_exists = 0, 'CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`)', 'SELECT "idx_users_email ok"');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─── Seed: initial admin account ───────────────────────────────────────────
-- Username: admin
-- Password: UcxkYx#wRwv&snG8bx#K
-- Layout matches dashboard.ts (salt:scryptHex, scryptSync(pw, salt, 64))
INSERT IGNORE INTO `admin_accounts`
  (`username`, `passwordHash`, `displayName`, `createdAt`, `updatedAt`)
VALUES
  ('admin', '9940c50246f57be1e90f0482a2c3350b:5d195cec500c0e2d20b9b912ef5225d87e25ff42d17472e3bf997c2d02363580e0d7c014f8ea8b29048ac96e685d25386bc81424c2109c032b4731d5acb645bf', '管理員', NOW(), NOW());

SET FOREIGN_KEY_CHECKS=1;

-- ─── Verify ────────────────────────────────────────────────────────────────
SHOW TABLES;
SELECT id, username, displayName, createdAt FROM `admin_accounts`;
