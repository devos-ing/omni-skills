# New User Onboarding

## Goal

Get a new operator from zero setup to running a scoped project workflow.

## Preconditions

1. Repository is cloned.
2. `bun`, `gh`, and `rtk` are installed.
3. Linear and GitHub credentials are available.

## Setup

1. Run `adhd-ai setup` and answer the guided prompts.
2. Confirm the wizard writes `.env` for secrets and `adhd-ai.local.config.ts` for local project settings.
3. Run `adhd-ai setup --check` to verify config, GitHub auth, RTK availability, Codex availability, and secret placement.

## First Run

1. Run `bun run src/index.ts projects` to verify project resolution.
2. Run `bun run src/index.ts run --project <PROJECT_ID>` for one scoped project.
3. Validate run state appears under `.piv-loop/projects/<project-id>/runs`.

## Success Criteria

1. One issue is picked up for the selected project.
2. Stage transitions reach planning and implementation.
3. Linear comments reflect workflow progress.
