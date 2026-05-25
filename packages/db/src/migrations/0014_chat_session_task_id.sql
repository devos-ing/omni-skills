ALTER TABLE chat_sessions
	ADD COLUMN IF NOT EXISTS task_id text REFERENCES board_tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS chat_sessions_task_idx
	ON chat_sessions (task_id);
