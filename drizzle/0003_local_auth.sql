-- Migration 0003: Add local email+password authentication, learning progress, and exercises

-- Make openId nullable for local users, add passwordHash column
ALTER TABLE users MODIFY COLUMN `openId` varchar(64) NULL;
ALTER TABLE users ADD COLUMN `passwordHash` varchar(256) NULL AFTER `openId`;

-- Add unique index on email for local auth login
CREATE UNIQUE INDEX `idx_users_email` ON users (`email`);

-- User progress tracking
CREATE TABLE IF NOT EXISTS `user_progress` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `documentId` int NOT NULL,
  `lastSegmentId` varchar(64) NULL,
  `completedSegments` json NULL,
  `status` enum('not_started','in_progress','completed') NOT NULL DEFAULT 'not_started',
  `completedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `unq_progress_user_doc` (`userId`, `documentId`),
  INDEX `idx_progress_user_doc` (`userId`, `documentId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Exercises (quiz system)
CREATE TABLE IF NOT EXISTS `exercises` (
  `id` int NOT NULL AUTO_INCREMENT,
  `documentId` int NOT NULL,
  `segmentId` varchar(64) NULL,
  `question` text NOT NULL,
  `options` json NULL,
  `correctAnswer` varchar(512) NOT NULL,
  `type` enum('choice','true_false','fill') NOT NULL DEFAULT 'choice',
  `order` int NOT NULL DEFAULT '0',
  `createdBy` int NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_exercise_doc` (`documentId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Exercise attempts
CREATE TABLE IF NOT EXISTS `exercise_attempts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `exerciseId` int NOT NULL,
  `userId` int NOT NULL,
  `answer` text NOT NULL,
  `isCorrect` tinyint NOT NULL DEFAULT '0',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_attempt_user_exercise` (`userId`, `exerciseId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
