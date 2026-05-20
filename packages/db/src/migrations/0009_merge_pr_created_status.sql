UPDATE board_tasks
SET status = 'reviewing'
WHERE status = 'pr_created';
