-- ============================================================
-- ome-translate / ome-transalate — schema fix for glossary_entries
-- Run after the initial init.sql. Safe to re-run.
-- ============================================================

USE zeabur;

-- englishTerm: NOT NULL with empty-string default
SET @col := (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'glossary_entries' AND column_name = 'englishTerm');
SET @sql := IF(@col = 0,
  'ALTER TABLE `glossary_entries` ADD COLUMN `englishTerm` varchar(512) NOT NULL DEFAULT ''''''',
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

-- Drop legacy columns from old 0001 schema
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

-- Verify
SHOW COLUMNS FROM `glossary_entries`;
