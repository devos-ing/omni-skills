ALTER TABLE board_projects
	ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;
