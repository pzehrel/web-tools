CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text,
	`user_id` text,
	`tool_id` text NOT NULL,
	`inline_payload` text,
	`blob_key` text,
	`mime_type` text,
	`size` integer DEFAULT 0 NOT NULL,
	`meta` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assets_device_tool_id` ON `assets` (`device_id`,`tool_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `assets_user_tool_id` ON `assets` (`user_id`,`tool_id`,`id`);--> statement-breakpoint
CREATE INDEX `assets_user_tool_idx` ON `assets` (`user_id`,`tool_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);