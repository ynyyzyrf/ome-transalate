ALTER TABLE `translation_jobs` ADD `workerId` varchar(64);--> statement-breakpoint
ALTER TABLE `translation_jobs` ADD `attempts` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `translation_jobs` ADD `claimedAt` timestamp;