CREATE TABLE IF NOT EXISTS chat_sessions (
	id text PRIMARY KEY,
	workspace_id text NOT NULL,
	project_id text REFERENCES board_projects(id) ON DELETE SET NULL,
	title text NOT NULL,
	pending_request text,
	pending_questions text,
	created_at timestamp NOT NULL,
	updated_at timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
	id text PRIMARY KEY,
	session_id text NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
	role text NOT NULL,
	kind text NOT NULL,
	content text NOT NULL,
	task_id text,
	command_action text,
	metadata text,
	created_at timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS chat_sessions_workspace_updated_idx
	ON chat_sessions (workspace_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS chat_messages_session_created_idx
	ON chat_messages (session_id, created_at ASC);
