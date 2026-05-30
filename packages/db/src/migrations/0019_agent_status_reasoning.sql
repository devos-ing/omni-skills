ALTER TABLE agents
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'online';

ALTER TABLE agents
ADD COLUMN IF NOT EXISTS reasoning_effort text;
