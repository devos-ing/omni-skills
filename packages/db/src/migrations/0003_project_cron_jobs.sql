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
