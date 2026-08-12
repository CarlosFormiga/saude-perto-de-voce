CREATE TABLE `citizen_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`citizen_id` text NOT NULL,
	`file_name` text NOT NULL,
	`storage_key` text NOT NULL,
	`content_type` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
