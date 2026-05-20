ALTER TABLE board_tasks
ADD COLUMN IF NOT EXISTS linear_issue_id text;

ALTER TABLE board_tasks
ADD COLUMN IF NOT EXISTS linear_identifier text;

ALTER TABLE board_tasks
ADD COLUMN IF NOT EXISTS linear_url text;
