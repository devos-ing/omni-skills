# PIV Loop (Codex CLI Orchestrator)

PIV Loop is a Bun + TypeScript CLI that automates a Linear-to-Codex-to-GitHub workflow across one or many projects.

## Workflow

1. Pull assigned Linear issues.
2. Run plan and implement in the same Codex session.
3. Open a draft PR after implementation.
4. Run review/testing in a separate Codex session.
5. Post review comments and create GitHub issues for detected bugs.
6. Keep Linear status synchronized per stage.

## Multi-Project Configuration

Configuration is loaded from `piv-loop.config.ts` and resolved into project-specific runtime settings.

- Root defaults can define shared repo, linear, codex, skills, and dry-run behavior.
- Polling is a single global config at the root `polling` key (`intervalMs`, `maxCycles`, `exitWhenIdle`) and applies to all selected projects in a run.
- `projects` contains one or more project entries, each with:
  - `id` (required)
  - `name` (optional)
  - overrides such as `workspacePath`, `executionPath`, `repo`, `linear`, `codex`, `skills`, `dryRun`

Path behavior:

- `workspacePath`: where PIV loop stores state and temp artifacts.
- `executionPath`: local repo path where `codex`, `git`, and `gh` commands run.

Run state is namespaced per project at:

` .piv-loop/projects/<project-id>/runs/<LINEAR_KEY>.json `

Legacy fallback for default project:

` .piv-loop/runs/<LINEAR_KEY>.json `

## Commands

```bash
bun run src/index.ts run --project default
bun run src/index.ts run --all-projects
bun run src/index.ts run --project default --issue ENG-123
bun run src/index.ts run --project default --poll
bun run src/index.ts run --project default --poll --poll-interval-ms 15000 --max-poll-cycles 20
bun run src/index.ts run --all-projects --poll --no-exit-when-idle
bun run src/index.ts status --project default --issue ENG-123
bun run src/index.ts projects
```

## Required Environment

Set these variables before running:

- `LINEAR_API_KEY`
- `LINEAR_STATUS_ASSIGNED`
- `LINEAR_STATUS_PLANNING`
- `LINEAR_STATUS_IMPLEMENTING`
- `LINEAR_STATUS_PR_CREATED`
- `LINEAR_STATUS_REVIEWING`
- `LINEAR_STATUS_TESTING`
- `LINEAR_STATUS_BLOCKED`
- `LINEAR_STATUS_DONE`
- `LINEAR_LABEL_PR_CREATED` (optional, default `PR Created`)
- `LINEAR_LABEL_REVIEWING` (optional, default `Reviewing`)
- `LINEAR_LABEL_TESTING` (optional, default `Testing`)
- `LINEAR_AUTO_CREATE_LABELS` (optional, default `1`)

Optional:

- `GITHUB_REPO_OWNER`
- `GITHUB_REPO_NAME`
- `GITHUB_BASE_BRANCH` (default `main`)
- `PIV_WORKSPACE_PATH` (default current directory; state root)
- `PIV_EXECUTION_PATH` (default `PIV_WORKSPACE_PATH`; command execution path)
- `PIV_POLL_INTERVAL_MS` (default `30000`; polling sleep between cycles)
- `PIV_MAX_POLL_CYCLES` (optional; stop polling after this many cycles)
- `PIV_EXIT_WHEN_IDLE` (optional; default `1`, set `0` to keep polling when no issues are found)
  - these environment variables configure the single global polling loop
- `PIV_DRY_RUN=1` to avoid Linear/GitHub mutations
- `PIV_DEV_MODE=1` to stream Codex stdout/stderr logs during runs
- `CODEX_SANDBOX` (optional; leave empty to disable sandbox, or set `read-only`, `workspace-write`, `danger-full-access`)
- `CODEX_MODEL_PLAN` (optional; overrides planning model)
- `CODEX_MODEL_IMPLEMENT` (optional; overrides implementation model)
- `CODEX_MODEL_REVIEW_TEST` (optional; overrides review/testing model)
- `CODEX_HOME` to override Codex runtime state directory
- `PIV_LOG_LEVEL` (optional; default `info`)
- `PIV_LOG_PRETTY` (optional; default `1` in TTY, `0` otherwise)

`LINEAR_STATUS_*` values may be either Linear workflow state IDs or exact state names (for example `Todo`, `In Progress`, `Done`). Names are resolved to IDs at runtime.

Recommended mapping for your board:

- `assigned`: `Todo`
- `planning`: `In Progress`
- `implementing`: `In Progress`
- `pr_created`: `In Review`
- `reviewing`: `In Review`
- `testing`: `In Review`
- `blocked`: `Canceled`
- `done`: `Done`

Stage labels are applied automatically for:

- `pr_created` -> `PR Created`
- `reviewing` -> `Reviewing`
- `testing` -> `Testing`

## Quality Commands

```bash
bun run check
bun run typecheck
bun test
```

## Notes

- Run with authenticated `gh` (`gh auth status`).
- Codex uses the default CLI home unless you explicitly set `CODEX_HOME`.
- Linear integration uses the official `@linear/sdk` client.
