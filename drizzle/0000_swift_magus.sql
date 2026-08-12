CREATE TABLE `activation_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`citizen_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`status` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `admin_users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`login` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`active` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_users_login_unique` ON `admin_users` (`login`);--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text,
	`details` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `citizens` (
	`id` text PRIMARY KEY NOT NULL,
	`cpf_hash` text NOT NULL,
	`cpf_masked` text NOT NULL,
	`full_name` text NOT NULL,
	`birth_date` text NOT NULL,
	`validation_status` text NOT NULL,
	`first_pickup_required` integer NOT NULL,
	`address` text,
	`district` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `citizens_cpf_hash_unique` ON `citizens` (`cpf_hash`);--> statement-breakpoint
CREATE TABLE `credentials` (
	`citizen_id` text PRIMARY KEY NOT NULL,
	`password_hash` text NOT NULL,
	`activated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lots` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`lot_number` text NOT NULL,
	`expires_on` text NOT NULL,
	`balance` real NOT NULL,
	`reserved` real NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`citizen_id` text NOT NULL,
	`sender` text NOT NULL,
	`body` text NOT NULL,
	`read_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`citizen_id` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`read_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`active_ingredient` text NOT NULL,
	`presentation` text NOT NULL,
	`unit` text NOT NULL,
	`minimum_stock` real NOT NULL,
	`requires_prescription` integer NOT NULL,
	`delivery_allowed` integer NOT NULL,
	`public_visible` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_code_unique` ON `products` (`code`);--> statement-breakpoint
CREATE TABLE `requests` (
	`id` text PRIMARY KEY NOT NULL,
	`protocol` text NOT NULL,
	`citizen_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` real NOT NULL,
	`method` text NOT NULL,
	`status` text NOT NULL,
	`slot_id` text,
	`prescription_name` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `requests_protocol_unique` ON `requests` (`protocol`);--> statement-breakpoint
CREATE TABLE `schedule_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`method` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`capacity` integer NOT NULL,
	`reserved_count` integer NOT NULL,
	`active` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`principal_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE TABLE `specialties` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`active` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `specialties_name_unique` ON `specialties` (`name`);--> statement-breakpoint
CREATE TABLE `specialty_interests` (
	`id` text PRIMARY KEY NOT NULL,
	`citizen_id` text NOT NULL,
	`specialty_id` text NOT NULL,
	`preferred_location` text NOT NULL,
	`preferred_period` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `specialty_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`specialty_id` text NOT NULL,
	`location` text NOT NULL,
	`starts_at` text NOT NULL,
	`status` text NOT NULL,
	`capacity` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stock_needs` (
	`id` text PRIMARY KEY NOT NULL,
	`citizen_id` text NOT NULL,
	`product_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
