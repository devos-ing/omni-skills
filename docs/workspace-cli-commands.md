# Workspace CLI Commands

This guide documents the devos.ing ADHD workspace CLI commands exposed by `packages/cli`.

## Invocation

Use one of these forms:

- Local npx entrypoint: `npx devos <command> ...` (after `bun install` and `bun run build`)
- Installed binary: `devos <command> ...` (help text form)

## Prerequisites

1. Bun installed.
2. Dependencies installed with `bun install`.
3. Config present in `devos.config.ts` (or local overrides in `devos.local.config.ts`).
4. Required credentials configured (for example Linear and GitHub settings used by your project).
5. Initial onboarding completed with `onboard`, then validated with `onboard --check`.
6. A valid project ID available from the `projects` command output.

## Configuration Coverage

The commands below read from the resolved runtime project config (from `devos.config.ts` plus optional `devos.local.config.ts` overrides). The most relevant fields are:

- `projects[].id`: project identifier used by `--project`.
- `projects[].workspacePath`: where run state is stored and read.
- `projects[].executionPath`: where workflow execution happens.
- `projects[].linear`: Linear credentials, status IDs, and routing metadata.
- `projects[].github`: repository owner/name/base branch and PR/merge behavior.
- `projects[].workflow`: polling, concurrency, and isolated worktree behavior.
- `projects[].skills`: skills root and stage skill files (`plan`, `implement`, `reviewTest`, `githubComment`).

Command-specific configuration dependencies:

- `onboard`:
  - Writes/validates local onboarding data used to resolve runtime config and credentials.
  - `onboard --check` validates required config and environment for configured projects (for example Linear API key, execution path, and required skill files).
- `projects`:
  - Reads configured `projects[]` entries and prints each project ID plus resolved `executionPath` and `workspacePath`.
- `run`:
  - Uses project routing (`linear.projectId` when configured), Linear status/label mappings, and GitHub repo settings.
  - Uses `workflow.issueConcurrency`, polling settings, and `workflow.isolatedWorktrees` defaults when corresponding CLI flags are not provided.
  - Uses project `executionPath` and `workspacePath` for run orchestration and run-state persistence.
- `status`:
  - Requires `projectId` that resolves to a configured project.
  - Reads run-state files under the resolved project `workspacePath`.
- `task create`:
  - Uses project `linear` settings to create backlog tasks in the configured Linear team/project/status.
  - Uses configured agent backend/model settings to run intake and clarification passes.
- `skills` (`list`, `add`, `update`, `remove`):
  - Operates on the selected project's `skills.root`.
  - `--project` changes which configured project's skills root is targeted.

## Command Reference

### `onboard`

Syntax:

```bash
devos onboard [--check]
```

Examples:

```bash
npx devos onboard
npx devos onboard --check
```

Expected behavior:

- `onboard` runs the guided onboarding wizard.
- `onboard --check` runs onboarding validation checks only.

Configuration notes:

- Reads/writes local onboarding artifacts that feed runtime config resolution.
- Validation checks are project-aware and fail when required project config/env is missing.

### `projects`

Syntax:

```bash
devos projects
```

Example:

```bash
npx devos projects
```

Expected behavior:

- Lists configured projects.
- Each line is tab-separated and includes project ID, name, execution path, and state path.

Configuration notes:

- Output comes directly from configured `projects[]` and resolved path settings.

### `run`

Syntax:

```bash
devos run [--project <PROJECT_ID>] [--issue <LINEAR_KEY_OR_URL>] [--poll] [--no-exit-when-idle] [--concurrency <N>] [--poll-interval-ms <MS>] [--max-poll-cycles <N>] [--isolated-worktrees]
devos run --all-projects [--issue <LINEAR_KEY_OR_URL>] [--poll] [--no-exit-when-idle]
```

Examples:

```bash
npx devos run --project default --issue ENG-123
npx devos run --project default --poll
npx devos run --all-projects --poll
npx devos run --all-projects --poll-forever
```

Expected behavior:

- Starts workflow orchestration for one project or all projects.
- `--poll` keeps polling for eligible issues.
- `--poll-forever` is the daemon-owned continuous polling mode; it implies polling, ignores configured max cycles, disables idle exit, and cannot be combined with `--max-poll-cycles`.
- `--no-exit-when-idle` keeps process alive when no eligible work is found.
- Numeric flags (`--concurrency`, `--poll-interval-ms`, `--max-poll-cycles`) must be positive integers.
- `--isolated-worktrees` enables isolated per-issue worktree mode when supported by config.

Configuration notes:

- `--project` selects a configured project; `--all-projects` runs across all configured projects.
- Polling/concurrency/worktree defaults come from project `workflow` config when flags are omitted.
- Linear and GitHub behavior for each issue run depends on that project's `linear` and `github` config.

Validation notes:

- `--project` and `--all-projects` cannot be used together.

### `status`

Syntax:

```bash
devos status --project <PROJECT_ID> --issue <LINEAR_KEY>
```

Example:

```bash
npx devos status --project default --issue ENG-123
```

Expected behavior:

- Loads run state for the issue and prints JSON with a computed stage display value.
- Prints a not-found message if no run state exists for that project/issue key.

Configuration notes:

- Status lookup resolves to the selected project's state storage under `workspacePath`.

Validation notes:

- `--project` is required.
- `--issue` is required.

### `task create`

Syntax:

```bash
devos task create [<REQUEST>] [--request <TEXT|->] [--project <PROJECT_ID>] [--non-interactive] [--max-clarification-rounds <N>] [--clarifications-json <JSON>]
```

Examples:

```bash
npx devos task create --request "Add retry handling for API timeouts" --project default
npx devos task create "Investigate flaky review stage"
npx devos task create --request - --project default
npx devos task create --request "Backfill missing docs" --non-interactive --clarifications-json '[{"question":"Scope?","answer":"CLI docs only"}]'
```

Expected behavior:

- Interactive mode (default):
  - Uses `--request` value, positional request text, or prompts for a request.
  - If `--request -` is used, reads request content from stdin.
  - May ask follow-up clarification questions before creating a Linear issue.
- Non-interactive mode (`--non-interactive`):
  - Requires `--request <TEXT>` and does not prompt.
  - Returns unresolved clarification questions instead of creating an issue when context remains ambiguous.

Configuration notes:

- Uses selected project `linear` settings for backlog task creation target and status mapping.
- Uses selected project backend/model configuration to run clarification and intake logic.

Validation notes:

- `--non-interactive` cannot use `--request -`.
- Request must be non-empty after trimming.
- `--max-clarification-rounds` must be a positive integer when set.
- `--clarifications-json` must be a JSON array of objects with non-empty string `question` and `answer` fields.

### `skills`

Syntax:

```bash
devos skills list [--project <PROJECT_ID>]
devos skills add --title <TITLE> --description <TEXT> --content <TEXT> [--project <PROJECT_ID>]
devos skills update <NAME> [--title <TITLE>] [--description <TEXT>] [--content <TEXT>] [--project <PROJECT_ID>]
devos skills remove <NAME> [--project <PROJECT_ID>]
```

Examples:

```bash
npx devos skills list --project default
npx devos skills add --title "Docs Writer" --description "Writes release notes" --content "Use concise release note format." --project default
npx devos skills update docs-writer --description "Writes CLI release notes." --project default
npx devos skills remove docs-writer --project default
```

Expected behavior:

- `list` prints tab-separated skill rows (`name`, `title`, `description`), or a no-skills message.
- `add` creates a skill document and prints created name/path.
- `update` updates an existing skill and prints updated name/path.
- `remove` deletes a skill and prints removed name/path.

Configuration notes:

- All operations target the selected project's `skills.root`.

Validation notes:

- `skills update` requires `<NAME>`.
- `skills update` also requires at least one of `--title`, `--description`, or `--content`.
- `skills remove` requires `<NAME>`.
- Missing required flags for `add` produce explicit errors.

### `help`

Syntax:

```bash
devos help
devos --help
devos -h
```

Expected behavior:

- Prints command and environment help text.

## Related Documentation

- [NON_TECHNICAL_GUIDE.md](NON_TECHNICAL_GUIDE.md)
- [RELIABILITY.md](RELIABILITY.md)
- [SECURITY.md](SECURITY.md)
- [PLANS.md](PLANS.md)
