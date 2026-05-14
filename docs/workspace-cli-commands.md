# Workspace CLI Commands

This guide documents the devos.ing ADHD workspace CLI commands exposed by `packages/cli`.

## Invocation

Use one of these forms:

- Workspace source entrypoint: `bun run packages/cli/src/index.ts <command> ...`
- Package-local entrypoint: `bun run src/index.ts <command> ...` (from `packages/cli`)
- Installed binary: `adhd-ai <command> ...` (help text form)

## Prerequisites

1. Bun installed.
2. Dependencies installed with `bun install`.
3. Config present in `adhd-ai.config.ts` (or local overrides in `adhd-ai.local.config.ts`).
4. Required credentials configured (for example Linear and GitHub settings used by your project).
5. Initial setup completed with `setup`, then validated with `setup --check`.
6. A valid project ID available from the `projects` command output.

## Command Reference

### `setup`

Syntax:

```bash
adhd-ai setup [--check]
```

Examples:

```bash
bun run packages/cli/src/index.ts setup
bun run packages/cli/src/index.ts setup --check
```

Expected behavior:

- `setup` runs the guided setup wizard.
- `setup --check` runs setup validation checks only.

### `projects`

Syntax:

```bash
adhd-ai projects
```

Example:

```bash
bun run packages/cli/src/index.ts projects
```

Expected behavior:

- Lists configured projects.
- Each line is tab-separated and includes project ID, name, execution path, and state path.

### `run`

Syntax:

```bash
adhd-ai run [--project <PROJECT_ID>] [--issue <LINEAR_KEY_OR_URL>] [--poll] [--no-exit-when-idle] [--concurrency <N>] [--poll-interval-ms <MS>] [--max-poll-cycles <N>] [--isolated-worktrees]
adhd-ai run --all-projects [--issue <LINEAR_KEY_OR_URL>] [--poll] [--no-exit-when-idle]
```

Examples:

```bash
bun run packages/cli/src/index.ts run --project default --issue ENG-123
bun run packages/cli/src/index.ts run --project default --poll
bun run packages/cli/src/index.ts run --all-projects --poll
```

Expected behavior:

- Starts workflow orchestration for one project or all projects.
- `--poll` keeps polling for eligible issues.
- `--no-exit-when-idle` keeps process alive when no eligible work is found.
- Numeric flags (`--concurrency`, `--poll-interval-ms`, `--max-poll-cycles`) must be positive integers.
- `--isolated-worktrees` enables isolated per-issue worktree mode when supported by config.

Validation notes:

- `--project` and `--all-projects` cannot be used together.

### `status`

Syntax:

```bash
adhd-ai status --project <PROJECT_ID> --issue <LINEAR_KEY>
```

Example:

```bash
bun run packages/cli/src/index.ts status --project default --issue ENG-123
```

Expected behavior:

- Loads run state for the issue and prints JSON with a computed stage display value.
- Prints a not-found message if no run state exists for that project/issue key.

Validation notes:

- `--project` is required.
- `--issue` is required.

### `task create`

Syntax:

```bash
adhd-ai task create [<REQUEST>] [--request <TEXT|->] [--project <PROJECT_ID>] [--non-interactive] [--max-clarification-rounds <N>] [--clarifications-json <JSON>]
```

Examples:

```bash
bun run packages/cli/src/index.ts task create --request "Add retry handling for API timeouts" --project default
bun run packages/cli/src/index.ts task create "Investigate flaky review stage"
bun run packages/cli/src/index.ts task create --request - --project default
bun run packages/cli/src/index.ts task create --request "Backfill missing docs" --non-interactive --clarifications-json '[{"question":"Scope?","answer":"CLI docs only"}]'
```

Expected behavior:

- Interactive mode (default):
  - Uses `--request` value, positional request text, or prompts for a request.
  - If `--request -` is used, reads request content from stdin.
  - May ask follow-up clarification questions before creating a Linear issue.
- Non-interactive mode (`--non-interactive`):
  - Requires `--request <TEXT>` and does not prompt.
  - Returns unresolved clarification questions instead of creating an issue when context remains ambiguous.

Validation notes:

- `--non-interactive` cannot use `--request -`.
- Request must be non-empty after trimming.
- `--max-clarification-rounds` must be a positive integer when set.
- `--clarifications-json` must be a JSON array of objects with non-empty string `question` and `answer` fields.

### `skills`

Syntax:

```bash
adhd-ai skills list [--project <PROJECT_ID>]
adhd-ai skills add --title <TITLE> --description <TEXT> --content <TEXT> [--project <PROJECT_ID>]
adhd-ai skills update <NAME> [--title <TITLE>] [--description <TEXT>] [--content <TEXT>] [--project <PROJECT_ID>]
adhd-ai skills remove <NAME> [--project <PROJECT_ID>]
```

Examples:

```bash
bun run packages/cli/src/index.ts skills list --project default
bun run packages/cli/src/index.ts skills add --title "Docs Writer" --description "Writes release notes" --content "Use concise release note format." --project default
bun run packages/cli/src/index.ts skills update docs-writer --description "Writes CLI release notes." --project default
bun run packages/cli/src/index.ts skills remove docs-writer --project default
```

Expected behavior:

- `list` prints tab-separated skill rows (`name`, `title`, `description`), or a no-skills message.
- `add` creates a skill document and prints created name/path.
- `update` updates an existing skill and prints updated name/path.
- `remove` deletes a skill and prints removed name/path.

Validation notes:

- `skills update` requires `<NAME>`.
- `skills update` also requires at least one of `--title`, `--description`, or `--content`.
- `skills remove` requires `<NAME>`.
- Missing required flags for `add` produce explicit errors.

### `help`

Syntax:

```bash
adhd-ai help
adhd-ai --help
adhd-ai -h
```

Expected behavior:

- Prints command and environment help text.

## Related Documentation

- [NON_TECHNICAL_GUIDE.md](NON_TECHNICAL_GUIDE.md)
- [RELIABILITY.md](RELIABILITY.md)
- [SECURITY.md](SECURITY.md)
- [PLANS.md](PLANS.md)
