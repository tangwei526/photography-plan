CREATE TABLE `calendar_events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`event_date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shooting_themes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shooting_themes_name_unique` ON `shooting_themes` (`name`);
--> statement-breakpoint
INSERT INTO `shooting_themes` (`id`,`name`,`created_at`) VALUES
('theme-rain','雨天',1786207412444),
('theme-sunrise','朝霞',1786207412444),
('theme-sunset','晚霞',1786207412444),
('theme-celestial','日月对齐',1786207412444),
('theme-transit','轨道交通',1786207412444),
('theme-bridge','桥梁',1786207412444),
('theme-temple','寺庙',1786207412444),
('theme-rainbow','彩虹',1786207412444),
('theme-lightning','雷电',1786207412444),
('theme-interchange','立交',1786207412444);
