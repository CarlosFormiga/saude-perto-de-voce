CREATE TABLE `health_locations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`address` text NOT NULL,
	`district` text NOT NULL,
	`reference` text,
	`active` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `health_locations_name_unique` ON `health_locations` (`name`);--> statement-breakpoint
ALTER TABLE `specialty_interests` ADD `schedule_id` text;--> statement-breakpoint
ALTER TABLE `specialty_schedules` ADD `location_id` text;
--> statement-breakpoint
CREATE INDEX `idx_interests_schedule` ON `specialty_interests` (`schedule_id`, `status`);
