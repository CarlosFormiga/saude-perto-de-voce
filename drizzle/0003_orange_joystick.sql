CREATE TABLE `privacy_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`citizen_id` text NOT NULL,
	`request_type` text NOT NULL,
	`details` text,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`citizen_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`user_agent` text,
	`active` integer NOT NULL,
	`failure_count` integer NOT NULL,
	`last_success_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_unique` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
ALTER TABLE `requests` ADD `prescription_storage_key` text;--> statement-breakpoint
ALTER TABLE `requests` ADD `reserved_lot_id` text;--> statement-breakpoint
ALTER TABLE `requests` ADD `decision_reason` text;