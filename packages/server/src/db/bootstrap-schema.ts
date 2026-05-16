export const CREATE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS jobs (
	id text PRIMARY KEY,
	project_id text NOT NULL,
	issue_key text NOT NULL,
	stage text NOT NULL,
	status text NOT NULL,
	created_at timestamp NOT NULL
);
CREATE TABLE IF NOT EXISTS agents (
	id text PRIMARY KEY,
	name text NOT NULL,
	description text NOT NULL,
	logo text NOT NULL,
	runtime text NOT NULL,
	backend text NOT NULL,
	model text NOT NULL,
	concurrency integer NOT NULL,
	owner text NOT NULL,
	created_at timestamp NOT NULL,
	updated_at timestamp NOT NULL,
	skills text NOT NULL,
	recent_work text NOT NULL,
	activity text NOT NULL,
	instructions text NOT NULL
);
CREATE TABLE IF NOT EXISTS skills (
	id text PRIMARY KEY,
	name text NOT NULL,
	description text NOT NULL,
	source text NOT NULL,
	updated_at timestamp NOT NULL
);
CREATE TABLE IF NOT EXISTS command_history (
	id text PRIMARY KEY,
	command text NOT NULL,
	exit_code integer NOT NULL,
	executed_at timestamp NOT NULL
);
CREATE TABLE IF NOT EXISTS project_boards (
	id text PRIMARY KEY,
	name text NOT NULL,
	description text,
	owner_id text NOT NULL,
	created_at timestamp NOT NULL,
	updated_at timestamp NOT NULL
);
CREATE TABLE IF NOT EXISTS board_projects (
	id text PRIMARY KEY,
	board_id text NOT NULL REFERENCES project_boards(id),
	external_project_id text,
	name text NOT NULL,
	description text,
	owner_id text NOT NULL,
	created_at timestamp NOT NULL,
	updated_at timestamp NOT NULL
);
CREATE TABLE IF NOT EXISTS project_cron_jobs (
	id text PRIMARY KEY,
	project_id text NOT NULL REFERENCES board_projects(id),
	cron_expression text NOT NULL,
	target_type text NOT NULL,
	target text NOT NULL,
	skills text NOT NULL,
	enabled boolean NOT NULL,
	created_at timestamp NOT NULL,
	updated_at timestamp NOT NULL
);
CREATE INDEX IF NOT EXISTS project_cron_jobs_project_id_idx
ON project_cron_jobs(project_id);
CREATE TABLE IF NOT EXISTS board_tasks (
	id text PRIMARY KEY,
	task_key text NOT NULL,
	project_id text REFERENCES board_projects(id),
	title text NOT NULL,
	content text NOT NULL,
	priority integer NOT NULL,
	status text NOT NULL,
	due_date timestamp,
	creator_id text NOT NULL,
	linked_pr text,
	linear_issue_id text,
	linear_identifier text,
	linear_url text,
	created_at timestamp NOT NULL,
	updated_at timestamp NOT NULL
);
CREATE TABLE IF NOT EXISTS task_assignees (
	id text PRIMARY KEY,
	task_id text NOT NULL REFERENCES board_tasks(id),
	assignee_id text NOT NULL,
	assignee_type text NOT NULL,
	created_at timestamp NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS task_assignees_task_assignee_unique
ON task_assignees(task_id, assignee_id, assignee_type);
CREATE TABLE IF NOT EXISTS task_tags (
	id text PRIMARY KEY,
	task_id text NOT NULL REFERENCES board_tasks(id),
	tag text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS task_tags_task_tag_unique
ON task_tags(task_id, tag);
CREATE TABLE IF NOT EXISTS task_pull_requests (
	id text PRIMARY KEY,
	task_id text NOT NULL REFERENCES board_tasks(id),
	repository text NOT NULL,
	pr_number text NOT NULL,
	pr_url text,
	created_at timestamp NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS task_pull_requests_task_repo_pr_unique
ON task_pull_requests(task_id, repository, pr_number);
CREATE TABLE IF NOT EXISTS task_execution_logs (
	id text PRIMARY KEY,
	task_id text NOT NULL REFERENCES board_tasks(id),
	status text NOT NULL,
	started_at timestamp NOT NULL,
	finished_at timestamp,
	log text NOT NULL
);
CREATE TABLE IF NOT EXISTS task_execution_steps (
	id text PRIMARY KEY,
	execution_log_id text NOT NULL REFERENCES task_execution_logs(id),
	step_number integer NOT NULL,
	action text NOT NULL,
	status text NOT NULL,
	detail text,
	recorded_at timestamp NOT NULL
);
CREATE TABLE IF NOT EXISTS task_comments (
	id text PRIMARY KEY,
	task_id text NOT NULL REFERENCES board_tasks(id),
	author_id text NOT NULL,
	author_type text NOT NULL,
	comment text NOT NULL,
	created_at timestamp NOT NULL
);
CREATE TABLE IF NOT EXISTS token_usage (
	id text PRIMARY KEY,
	run_id text NOT NULL,
	task_id text REFERENCES board_tasks(id),
	task_execution_log_id text REFERENCES task_execution_logs(id),
	stage text NOT NULL,
	input_tokens integer NOT NULL,
	output_tokens integer NOT NULL,
	total_tokens integer NOT NULL,
	recorded_at timestamp NOT NULL
);
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
ALTER TABLE token_usage
ADD COLUMN IF NOT EXISTS task_id text REFERENCES board_tasks(id);
ALTER TABLE token_usage
ADD COLUMN IF NOT EXISTS task_execution_log_id text REFERENCES task_execution_logs(id);
ALTER TABLE board_tasks
ADD COLUMN IF NOT EXISTS linear_issue_id text;
ALTER TABLE board_tasks
ADD COLUMN IF NOT EXISTS linear_identifier text;
ALTER TABLE board_tasks
ADD COLUMN IF NOT EXISTS linear_url text;
ALTER TABLE board_tasks
ADD COLUMN IF NOT EXISTS task_key text;
WITH numbered AS (
	SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS row_number
	FROM board_tasks
	WHERE task_key IS NULL OR task_key = ''
)
UPDATE board_tasks
SET task_key = 'TASK-' || LPAD(numbered.row_number::text, 6, '0')
FROM numbered
WHERE board_tasks.id = numbered.id;
ALTER TABLE board_tasks
ALTER COLUMN task_key SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS board_tasks_task_key_unique
ON board_tasks(task_key);
ALTER TABLE board_tasks
ALTER COLUMN project_id DROP NOT NULL;
`;
