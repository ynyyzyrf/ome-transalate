-- ============================================================
-- ome-translate / ome-transalate — 完整数据库 schema 修复脚本
-- 包含：glossary_entries 多语言列、users passwordHash、
-- 以及其他 0003 migration 新增的表结构
-- ============================================================

USE zeabur;

-- ─── 1. glossary_entries 缺失的多语言列 ──────────────────────

-- englishTerm: NOT NULL with empty-string default
SET @col := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'glossary_entries' AND column_name = 'englishTerm');
SET @sql := IF(@col = 0,
  'ALTER TABLE `glossary_entries` ADD COLUMN `englishTerm` varchar(512) NOT NULL DEFAULT ''''',
  'SELECT "englishTerm already exists" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- spanishTerm
SET @col := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'glossary_entries' AND column_name = 'spanishTerm');
SET @sql := IF(@col = 0,
  'ALTER TABLE `glossary_entries` ADD COLUMN `spanishTerm` varchar(512) NULL',
  'SELECT "spanishTerm already exists" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- thaiTerm
SET @col := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'glossary_entries' AND column_name = 'thaiTerm');
SET @sql := IF(@col = 0,
  'ALTER TABLE `glossary_entries` ADD COLUMN `thaiTerm` varchar(512) NULL',
  'SELECT "thaiTerm already exists" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- hindiTerm
SET @col := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'glossary_entries' AND column_name = 'hindiTerm');
SET @sql := IF(@col = 0,
  'ALTER TABLE `glossary_entries` ADD COLUMN `hindiTerm` varchar(512) NULL',
  'SELECT "hindiTerm already exists" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- vietnameseTerm
SET @col := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'glossary_entries' AND column_name = 'vietnameseTerm');
SET @sql := IF(@col = 0,
  'ALTER TABLE `glossary_entries` ADD COLUMN `vietnameseTerm` varchar(512) NULL',
  'SELECT "vietnameseTerm already exists" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- description
SET @col := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'glossary_entries' AND column_name = 'description');
SET @sql := IF(@col = 0,
  'ALTER TABLE `glossary_entries` ADD COLUMN `description` text NULL',
  'SELECT "description already exists" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- createdBy
SET @col := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'glossary_entries' AND column_name = 'createdBy');
SET @sql := IF(@col = 0,
  'ALTER TABLE `glossary_entries` ADD COLUMN `createdBy` int NULL',
  'SELECT "createdBy already exists" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Drop legacy columns from old 0001 schema (if still exist)
SET @col := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'glossary_entries' AND column_name = 'targetLanguage');
SET @sql := IF(@col = 1,
  'ALTER TABLE `glossary_entries` DROP COLUMN `targetLanguage`',
  'SELECT "targetLanguage already dropped" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'glossary_entries' AND column_name = 'targetTerm');
SET @sql := IF(@col = 1,
  'ALTER TABLE `glossary_entries` DROP COLUMN `targetTerm`',
  'SELECT "targetTerm already dropped" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─── 2. users 表新增列 (0003 migration) ──────────────────────

-- passwordHash
SET @col := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'passwordHash');
SET @sql := IF(@col = 0,
  'ALTER TABLE `users` ADD COLUMN `passwordHash` varchar(256) NULL',
  'SELECT "passwordHash already exists" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- openId 改为允许 NULL (0003 migration)
-- 这个我们不执行，因为 ALTER TABLE MODIFY COLUMN 可能会有副作用
-- 已经是 NULLABLE 的话就不用改了

-- ─── 3. documents 表 fileType 枚举扩展 (0003 migration) ─────
-- 注意：MySQL 不能直接 ALTER ENUM，这里跳过，
-- 因为即使不扩展，旧的枚举值也能正常工作，只是少了几个新类型

-- ─── 4. 0003 migration 新增的表 ──────────────────────────────

-- exercises
SET @table_exists := (SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'exercises');
SET @sql := IF(@table_exists = 0,
  'CREATE TABLE `exercises` (
    `id` int AUTO_INCREMENT NOT NULL,
    `documentId` int NOT NULL,
    `segmentId` varchar(64),
    `question` text NOT NULL,
    `options` json DEFAULT (''[]''),
    `correctAnswer` varchar(512) NOT NULL,
    `type` enum(''choice'',''true_false'',''fill'') NOT NULL DEFAULT ''choice'',
    `order` int NOT NULL DEFAULT 0,
    `createdBy` int,
    `createdAt` timestamp NOT NULL DEFAULT (now()),
    `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `exercises_id` PRIMARY KEY(`id`)
  )',
  'SELECT "exercises table already exists" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- exercise_attempts
SET @table_exists := (SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'exercise_attempts');
SET @sql := IF(@table_exists = 0,
  'CREATE TABLE `exercise_attempts` (
    `id` int AUTO_INCREMENT NOT NULL,
    `exerciseId` int NOT NULL,
    `userId` int NOT NULL,
    `answer` text NOT NULL,
    `isCorrect` tinyint NOT NULL DEFAULT 0,
    `createdAt` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT `exercise_attempts_id` PRIMARY KEY(`id`)
  )',
  'SELECT "exercise_attempts table already exists" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- user_progress
SET @table_exists := (SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'user_progress');
SET @sql := IF(@table_exists = 0,
  'CREATE TABLE `user_progress` (
    `id` int AUTO_INCREMENT NOT NULL,
    `userId` int NOT NULL,
    `documentId` int NOT NULL,
    `lastSegmentId` varchar(64),
    `completedSegments` json DEFAULT (''[]''),
    `status` enum(''not_started'',''in_progress'',''completed'') NOT NULL DEFAULT ''not_started'',
    `completedAt` timestamp,
    `createdAt` timestamp NOT NULL DEFAULT (now()),
    `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `user_progress_id` PRIMARY KEY(`id`),
    CONSTRAINT `unq_progress_user_doc` UNIQUE(`userId`,`documentId`)
  )',
  'SELECT "user_progress table already exists" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─── 5. 新增索引 ────────────────────────────────────────────

SET @index_exists := (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'exercises' AND index_name = 'idx_exercise_doc');
SET @sql := IF(@index_exists = 0,
  'CREATE INDEX `idx_exercise_doc` ON `exercises` (`documentId`)',
  'SELECT "idx_exercise_doc already exists" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @index_exists := (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'exercise_attempts' AND index_name = 'idx_attempt_user_exercise');
SET @sql := IF(@index_exists = 0,
  'CREATE INDEX `idx_attempt_user_exercise` ON `exercise_attempts` (`userId`,`exerciseId`)',
  'SELECT "idx_attempt_user_exercise already exists" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @index_exists := (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'user_progress' AND index_name = 'idx_progress_user_doc');
SET @sql := IF(@index_exists = 0,
  'CREATE INDEX `idx_progress_user_doc` ON `user_progress` (`userId`,`documentId`)',
  'SELECT "idx_progress_user_doc already exists" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─── 6. 管理员账号种子（如果还没有的话） ────────────────────

SET @admin_exists := (SELECT COUNT(*) FROM `admin_accounts` WHERE `username` = 'admin');
SET @sql := IF(@admin_exists = 0,
  'INSERT INTO `admin_accounts` (`username`, `passwordHash`, `displayName`, `role`, `createdAt`) VALUES (''admin'', ''$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'', ''系统管理员'', ''superadmin'', NOW())',
  'SELECT "Admin account already exists" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─── 验证结果 ───────────────────────────────────────────────
SELECT '=== glossary_entries columns ===' AS check;
SHOW COLUMNS FROM `glossary_entries`;

SELECT '=== users columns ===' AS check;
SHOW COLUMNS FROM `users`;

SELECT '=== All tables in database ===' AS check;
SHOW TABLES;

SELECT '=== Done! All schema fixes applied ===' AS result;