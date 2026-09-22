CREATE TABLE `appointments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`patient_id` integer NOT NULL,
	`starts_at` text NOT NULL,
	`kind` text DEFAULT 'Consulta' NOT NULL,
	`status` text DEFAULT 'Agendada' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_appointments_owner_date` ON `appointments` (`owner_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `meal_plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`patient_id` integer NOT NULL,
	`title` text NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`meals_json` text DEFAULT '[]' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_meal_plans_patient` ON `meal_plans` (`patient_id`);--> statement-breakpoint
CREATE INDEX `idx_meal_plans_owner` ON `meal_plans` (`owner_id`);--> statement-breakpoint
CREATE TABLE `measurements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`patient_id` integer NOT NULL,
	`measured_on` text NOT NULL,
	`weight_kg` real,
	`waist_cm` real,
	`notes` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_measurements_owner_patient_date` ON `measurements` (`owner_id`,`patient_id`,`measured_on`);--> statement-breakpoint
CREATE TABLE `patients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`birth_date` text DEFAULT '' NOT NULL,
	`goal` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_patients_owner_name` ON `patients` (`owner_id`,`name`);