# devos.ing

Talk is cheap, show me your agent system.

devos.ing is ADHD (Agentic Development Hub & Daemon): an all-in-one workflow for managing agentic development, reducing human involvement while keeping operators in control. It turns Linear issues into an agent-driven engineering workflow: plan -> implement -> review/test. It can run one issue at a time or poll for new work across projects.

For non-technical operators, start with [docs/NON_TECHNICAL_GUIDE.md](docs/NON_TECHNICAL_GUIDE.md).

## Quick Start

1. Install dependencies.
2. Run guided onboarding.
3. Validate your onboarding.
4. Run one scoped workflow.

```bash
bun install
devos onboard
devos onboard --check
devos run --project <PROJECT_ID>
```

Use `devos projects` to list available project IDs, then pass one of those values as `<PROJECT_ID>`.

## Command Reference

Use `devos ...` after linking or installing the package bin.

### Help

Purpose: print CLI usage and available commands.

Syntax:

```bash
devos help
devos --help
devos -h
```

Output shape:

- Multi-line plain text usage guide.

Usage notes:

- No project config is required to render help.

### onboard

Purpose: run guided environment onboarding, or validate onboarding prerequisites.

Syntax:

```bash
devos onboard [--check]
```

Options:

- `--check`: run onboarding validation checks without opening the interactive wizard.

Output shape:

- Human-readable onboarding/check logs written to stdout/stderr.

Usage notes:

- `onboard` runs the interactive wizard.
- `onboard --check` performs validation only.

### projects

Purpose: list configured projects from runtime config.

Syntax:

```bash
devos projects
```

Output shape:

- One tab-separated line per project:
  `<id>\t<name>\texec=<executionPath>\tstate=<workspacePath>`

Usage notes:

- Useful for discovering valid values for `--project`.

### run

Purpose: run workflow orchestration for one issue or project scope.

Syntax:

```bash
devos run [--project <PROJECT_ID>] [--issue <LINEAR_KEY_OR_URL>] [--poll|--poll-forever] [--no-exit-when-idle] [--concurrency <N>] [--poll-interval-ms <MS>] [--max-poll-cycles <N>] [--isolated-worktrees]
devos run --all-projects [--issue <LINEAR_KEY_OR_URL>] [--poll|--poll-forever] [--no-exit-when-idle] [--concurrency <N>] [--poll-interval-ms <MS>] [--max-poll-cycles <N>] [--isolated-worktrees]
```

Options:

- `--project <PROJECT_ID>`: select one configured project.
- `--all-projects`: run across all configured projects.
- `--issue <LINEAR_KEY_OR_URL>`: scope run to a specific Linear issue.
- `--poll`: continue polling for new work.
- `--poll-forever`: daemon-friendly polling mode; implies `--poll`, ignores configured max cycles, disables idle exit, and cannot be combined with `--max-poll-cycles`.
- `--no-exit-when-idle`: disable automatic exit while idle.
- `--concurrency <N>`: positive integer worker concurrency.
- `--poll-interval-ms <MS>`: positive integer poll interval.
- `--max-poll-cycles <N>`: positive integer max polling cycles.
- `--isolated-worktrees`: enable isolated worktree mode.

Output shape:

- Streaming human-readable workflow logs and stage progress.

Usage notes:

- `--project` and `--all-projects` cannot be combined.
- Numeric options must be positive integers.

### status

Purpose: inspect persisted run state for one project/issue pair.

Syntax:

```bash
devos status --project <PROJECT_ID> --issue <LINEAR_KEY>
```

Options:

- `--project <PROJECT_ID>`: required project identifier.
- `--issue <LINEAR_KEY>`: required issue key.

Output shape:

- If state exists: pretty-printed JSON object including persisted run fields plus
  `stageDisplay`.
- If state does not exist: `No run state found for <ISSUE_KEY> in project <PROJECT_ID>`.

Usage notes:

- Both `--project` and `--issue` are required.

### task create

Purpose: generate a Linear backlog issue from a loose request through task intake.

Syntax:

```bash
devos task create [<REQUEST>] [--request <TEXT|->] [--project <PROJECT_ID>] [--non-interactive] [--max-clarification-rounds <N>] [--clarifications-json <JSON>]
```

Parameters and options:

- `<REQUEST>`: optional positional request text.
- `--request <TEXT|->`: request text; use `-` to read from stdin.
- `--project <PROJECT_ID>`: optional project override (defaults to first configured project).
- `--non-interactive`: disable interactive clarifying questions.
- `--max-clarification-rounds <N>`: optional positive integer cap.
- `--clarifications-json <JSON>`: optional JSON array of `{ "question": "...", "answer": "..." }`.

Output shape:

- On success: `Created Linear task <IDENTIFIER>: <URL>`.
- On unresolved intake: a multi-line message starting with
  `Task requirements are still unclear; no Linear issue was created.` and listing remaining questions.

Usage notes:

- In non-interactive mode, a non-empty request is required, provided either as positional `<REQUEST>` or `--request <TEXT>`.
- In non-interactive mode, `--request -` is not allowed.
- `--clarifications-json` must be valid JSON array entries with non-empty `question` and `answer` strings.

### skills list

Purpose: list skills for the selected project's skills root.

Syntax:

```bash
devos skills list [--project <PROJECT_ID>]
```

Output shape:

- If skills exist: one tab-separated line per skill:
  `<name>\t<title>\t<description|->`
- If none exist: `No skills found in <skillsRootPath>`.

Usage notes:

- `--project` is optional; defaults to first configured project.

### skills add

Purpose: create a new skill document in the selected project.

Syntax:

```bash
devos skills add --title "<TITLE>" --description "<DESCRIPTION>" --content "<CONTENT>" [--project <PROJECT_ID>]
```

Options:

- `--title <TITLE>`: required skill title.
- `--description <DESCRIPTION>`: required skill description.
- `--content <CONTENT>`: required skill body content.
- `--project <PROJECT_ID>`: optional project override.

Output shape:

- `Added skill <name> at <path>`.

### skills update

Purpose: update skill metadata/content by skill name.

Syntax:

```bash
devos skills update <NAME> [--title "<TITLE>"] [--description "<DESCRIPTION>"] [--content "<CONTENT>"] [--project <PROJECT_ID>]
```

Parameters and options:

- `<NAME>`: required skill name.
- `--title <TITLE>`: optional new title.
- `--description <DESCRIPTION>`: optional new description.
- `--content <CONTENT>`: optional new content.
- `--project <PROJECT_ID>`: optional project override.

Output shape:

- `Updated skill <name> at <path>`.

Usage notes:

- At least one of `--title`, `--description`, or `--content` is required.

### skills remove

Purpose: remove a skill by name from the selected project.

Syntax:

```bash
devos skills remove <NAME> [--project <PROJECT_ID>]
```

Parameters and options:

- `<NAME>`: required skill name.
- `--project <PROJECT_ID>`: optional project override.

Output shape:

- `Removed skill <name> from <path>`.

After linking/installing the package bin, you can also use `devos ...` directly.

## Configuration Notes

- Primary config: `devos.config.ts`.
- Local overrides (gitignored): `devos.local.config.ts`.
- Guided onboarding stores local secrets in `.devos/config/env.sqlite` (and writes `.env` for compatibility) and writes `.devos/config/instance.config.json` for the local trusted instance.
- Docker-isolated Codex execution status and caveats (ROY-95): [docs/RELIABILITY.md#docker-isolated-codex-execution](docs/RELIABILITY.md#docker-isolated-codex-execution)

For full config shape, polling, env vars, and routing behavior, use:

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [docs/PLANS.md](docs/PLANS.md)
- [docs/RELIABILITY.md](docs/RELIABILITY.md)
- [docs/SECURITY.md](docs/SECURITY.md)

## Quality Checks

Run these before opening or updating a PR:

```bash
bun run check
bun run typecheck
bun test
```

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=1997roylee/show-me-ur-agents&type=Date)](https://star-history.com/#1997roylee/show-me-ur-agents&Date)
