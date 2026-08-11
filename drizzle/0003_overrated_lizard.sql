CREATE TABLE `exercise_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`exerciseId` int NOT NULL,
	`userId` int NOT NULL,
	`answer` text NOT NULL,
	`isCorrect` tinyint NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exercise_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`segmentId` varchar(64),
	`question` text NOT NULL,
	`options` json DEFAULT ('[]'),
	`correctAnswer` varchar(512) NOT NULL,
	`type` enum('choice','true_false','fill') NOT NULL DEFAULT 'choice',
	`order` int NOT NULL DEFAULT 0,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `exercises_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_progress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`documentId` int NOT NULL,
	`lastSegmentId` varchar(64),
	`completedSegments` json DEFAULT ('[]'),
	`status` enum('not_started','in_progress','completed') NOT NULL DEFAULT 'not_started',
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_progress_id` PRIMARY KEY(`id`),
	CONSTRAINT `unq_progress_user_doc` UNIQUE(`userId`,`documentId`)
);
--> statement-breakpoint
ALTER TABLE `users` DROP INDEX `users_openId_unique`;--> statement-breakpoint
ALTER TABLE `documents` MODIFY COLUMN `fileType` enum('pdf','docx','doc','xlsx','pptx','vsdx','xmind','jpg','png','other') NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `openId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(256);--> statement-breakpoint
CREATE INDEX `idx_attempt_user_exercise` ON `exercise_attempts` (`userId`,`exerciseId`);--> statement-breakpoint
CREATE INDEX `idx_exercise_doc` ON `exercises` (`documentId`);--> statement-breakpoint
CREATE INDEX `idx_progress_user_doc` ON `user_progress` (`userId`,`documentId`);