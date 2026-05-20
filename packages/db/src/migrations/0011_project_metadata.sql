ALTER TABLE board_projects ADD COLUMN IF NOT EXISTS repo_owner text;
ALTER TABLE board_projects ADD COLUMN IF NOT EXISTS repo_name text;
ALTER TABLE board_projects ADD COLUMN IF NOT EXISTS base_branch text;
ALTER TABLE board_projects ADD COLUMN IF NOT EXISTS local_folder text;
ALTER TABLE board_projects ADD COLUMN IF NOT EXISTS lead text;
ALTER TABLE board_projects ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE board_projects ADD COLUMN IF NOT EXISTS priority integer;
