CREATE TABLE IF NOT EXISTS inbox_messages (
	id text PRIMARY KEY,
	workspace_id text NOT NULL,
	user_id text NOT NULL,
	run_id text NOT NULL,
	source text NOT NULL,
	kind text NOT NULL,
	body text NOT NULL,
	task_id text REFERENCES board_tasks(id),
	agent_id text REFERENCES agents(id),
	metadata text,
	created_at timestamp NOT NULL
);
CREATE INDEX IF NOT EXISTS inbox_messages_scope_created_at_idx
ON inbox_messages(workspace_id, user_id, run_id, created_at);
