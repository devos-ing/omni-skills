ALTER TABLE token_usage
ADD COLUMN IF NOT EXISTS task_id text REFERENCES board_tasks(id);

ALTER TABLE token_usage
ADD COLUMN IF NOT EXISTS task_execution_log_id text REFERENCES task_execution_logs(id);
