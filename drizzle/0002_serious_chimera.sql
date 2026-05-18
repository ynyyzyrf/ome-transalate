CREATE TABLE `admin_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(64) NOT NULL,
	`passwordHash` varchar(256) NOT NULL,
	`displayName` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_accounts_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `feedbacks` (
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
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `feedbacks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `documents` ADD `category` varchar(128);--> statement-breakpoint
ALTER TABLE `documents` ADD `instructor` varchar(256);--> statement-breakpoint
ALTER TABLE `documents` ADD `description` text;--> statement-breakpoint
ALTER TABLE `documents` ADD `sortOrder` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `glossary_entries` ADD `englishTerm` varchar(512) NOT NULL;--> statement-breakpoint
ALTER TABLE `glossary_entries` ADD `spanishTerm` varchar(512);--> statement-breakpoint
ALTER TABLE `glossary_entries` ADD `thaiTerm` varchar(512);--> statement-breakpoint
ALTER TABLE `glossary_entries` ADD `hindiTerm` varchar(512);--> statement-breakpoint
ALTER TABLE `glossary_entries` ADD `vietnameseTerm` varchar(512);--> statement-breakpoint
CREATE INDEX `idx_feedback_tutorial` ON `feedbacks` (`tutorialId`);--> statement-breakpoint
CREATE INDEX `idx_feedback_user` ON `feedbacks` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_feedback_status` ON `feedbacks` (`status`);--> statement-breakpoint
ALTER TABLE `glossary_batches` DROP COLUMN `targetLanguage`;--> statement-breakpoint
ALTER TABLE `glossary_entries` DROP COLUMN `targetLanguage`;--> statement-breakpoint
ALTER TABLE `glossary_entries` DROP COLUMN `targetTerm`;