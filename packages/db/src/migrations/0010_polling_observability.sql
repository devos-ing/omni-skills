CREATE TABLE IF NOT EXISTS polling_status (
	id text PRIMARY KEY,
	source_type text NOT NULL,
	source_id text NOT NULL,
	project_id text,
	state text NOT NULL,
	interval_ms integer NOT NULL,
	last_started_at timestamp,
	last_finished_at timestamp,
	last_success_at timestamp,
	last_error_at timestamp,
	last_issue_count integer NOT NULL,
	last_stale_retry_count integer NOT NULL,
	last_ready_task_count integer NOT NULL,
	last_dispatch_count integer NOT NULL,
	consecutive_failures integer NOT NULL,
	last_error text,
	updated_at timestamp NOT NULL
);
CREATE INDEX IF NOT EXISTS polling_status_source_idx
ON polling_status(source_type, source_id);

CREATE TABLE IF NOT EXISTS polling_events (
	id text PRIMARY KEY,
	poller_id text NOT NULL,
	source_type text NOT NULL,
	source_id text NOT NULL,
	project_id text,
	level text NOT NULL,
	event_type text NOT NULL,
	message text NOT NULL,
	metadata text NOT NULL,
	created_at timestamp NOT NULL
);
CREATE INDEX IF NOT EXISTS polling_events_poller_created_idx
ON polling_events(poller_id, created_at);
