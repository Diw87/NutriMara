CREATE TABLE `photo_assessments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`patient_id` integer NOT NULL,
	`measured_on` text NOT NULL,
	`height_cm` real NOT NULL,
	`front_key` text NOT NULL,
	`side_key` text NOT NULL,
	`front_width_cm` real NOT NULL,
	`side_depth_cm` real NOT NULL,
	`waist_estimate_cm` real NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_photo_assessments_owner_patient_date` ON `photo_assessments` (`owner_id`,`patient_id`,`measured_on`);