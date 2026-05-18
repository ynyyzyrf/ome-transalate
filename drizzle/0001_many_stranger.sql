CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(512) NOT NULL,
	`originalFilename` varchar(512) NOT NULL,
	`fileType` enum('pdf','docx','xlsx','pptx','jpg','png','other') NOT NULL,
	`fileSize` bigint NOT NULL,
	`s3Key` varchar(1024) NOT NULL,
	`s3Url` text NOT NULL,
	`extractedText` text,
	`segments` json,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`uploadedBy` int NOT NULL,
	`isPublished` enum('yes','no') NOT NULL DEFAULT 'no',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `glossary_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`filename` varchar(512) NOT NULL,
	`s3Key` varchar(1024) NOT NULL,
	`entriesCount` int NOT NULL DEFAULT 0,
	`targetLanguage` varchar(16) NOT NULL,
	`uploadedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `glossary_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `glossary_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceTerm` varchar(512) NOT NULL,
	`targetLanguage` varchar(16) NOT NULL,
	`targetTerm` varchar(512) NOT NULL,
	`description` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `glossary_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `translation_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`targetLanguage` varchar(16) NOT NULL,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`translatedSegments` json,
	`outputS3Key` varchar(1024),
	`outputS3Url` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `translation_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `preferredLanguage` varchar(16) DEFAULT 'zh' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_doc_lang` ON `translation_jobs` (`documentId`,`targetLanguage`);