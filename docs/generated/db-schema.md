# DB Schema (Generated)

Core server workflow schema lives in `packages/server/src/db/` and is initialized by `initializeServerDatabase`.

## Existing operational tables

- `jobs`: workflow jobs by project/issue/stage/state.
- `agents`: agent identity records.
- `skills`: skill catalog snapshots.
- `command_history`: executed CLI command audit.

## Project board workflow tables

- `project_boards`:
  - Primary key: `id`
  - Required: `name`, `owner_id`, `created_at`, `updated_at`
  - Optional: `description`
- `board_projects`:
  - Primary key: `id`
  - Foreign key: `board_id -> project_boards.id`
  - Required: `name`, `owner_id`, `created_at`, `updated_at`
  - Optional: `external_project_id`, `description`
- `board_tasks`:
  - Primary key: `id`
  - Foreign key: `project_id -> board_projects.id`
  - Required: `title`, `content`, `priority`, `status`, `creator_id`, `created_at`, `updated_at`
  - Optional: `due_date`, `linked_pr`
- `task_assignees`:
  - Primary key: `id`
  - Foreign key: `task_id -> board_tasks.id`
  - Required: `assignee_id`, `assignee_type`, `created_at`
  - Unique: `(task_id, assignee_id, assignee_type)`
- `task_tags`:
  - Primary key: `id`
  - Foreign key: `task_id -> board_tasks.id`
  - Required: `tag`
  - Unique: `(task_id, tag)`
- `task_pull_requests`:
  - Primary key: `id`
  - Foreign key: `task_id -> board_tasks.id`
  - Required: `repository`, `pr_number`, `created_at`
  - Optional: `pr_url`
  - Unique: `(task_id, repository, pr_number)`
- `task_execution_logs`:
  - Primary key: `id`
  - Foreign key: `task_id -> board_tasks.id`
  - Required: `status`, `started_at`, `log`
  - Optional: `finished_at`
- `task_execution_steps`:
  - Primary key: `id`
  - Foreign key: `execution_log_id -> task_execution_logs.id`
  - Required: `step_number`, `action`, `status`, `recorded_at`
  - Optional: `detail`
- `task_comments`:
  - Primary key: `id`
  - Foreign key: `task_id -> board_tasks.id`
  - Required: `author_id`, `author_type`, `comment`, `created_at`

## Token usage

- `token_usage` remains backward compatible for run/stage usage while adding optional workflow linkage:
  - Optional foreign keys: `task_id -> board_tasks.id`, `task_execution_log_id -> task_execution_logs.id`
  - Existing required fields retained: `run_id`, `stage`, token counts, `recorded_at`
