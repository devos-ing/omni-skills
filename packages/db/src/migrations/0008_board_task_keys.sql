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
