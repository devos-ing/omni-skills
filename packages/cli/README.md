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
devos run --issue ENG-123
```

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
- Default onboarding enables per-issue isolated git worktrees for local runs.
- `onboard --check` performs validation only.

### run

Purpose: run workflow orchestration for one issue or the configured queue.

Syntax:

```bash
devos run [--issue <LINEAR_KEY_OR_URL>] [--poll|--poll-forever] [--no-exit-when-idle] [--concurrency <N>] [--poll-interval-ms <MS>] [--max-poll-cycles <N>] [--isolated-worktrees]
```

Options:

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

- Numeric options must be positive integers.

### status

Purpose: inspect persisted run state for one issue.

Syntax:

```bash
devos status --issue <LINEAR_KEY>
```

Options:

- `--issue <LINEAR_KEY>`: required issue key.

Output shape:

- If state exists: pretty-printed JSON object including persisted run fields plus
  `stageDisplay`.
- If state does not exist: `No run state found for <ISSUE_KEY>`.

Usage notes:

- `--issue` is required.

### release

Purpose: inspect GitHub Releases and run the tag-only release marker flow.

Syntax:

```bash
devos release list [--limit <N>] [--repo <OWNER/REPO>]
devos release tag <TAG> [--message <MESSAGE>] [--remote <REMOTE>]
```

Options:

- `--limit <N>`: positive integer number of GitHub Releases to list.
- `--repo <OWNER/REPO>`: optional GitHub repository for `release list`.
- `--message <MESSAGE>`: annotated tag message for `release tag`.
- `--remote <REMOTE>`: git remote to push to; defaults to `origin`.

Output shape:

- `release list` streams `gh release list` output.
- `release tag` streams `git tag` and `git push` output.

Usage notes:

- `release tag` only creates and pushes an annotated git tag. It does not create
  a GitHub Release and does not publish npm packages.
- Use `gh release create <TAG>` later if you want a GitHub Release entry from an
  existing tag.

### task create

Purpose: generate a Linear backlog issue from a loose request through task intake.

Syntax:

```bash
devos task create [<REQUEST>] [--request <TEXT|->] [--non-interactive] [--max-clarification-rounds <N>] [--clarifications-json <JSON>]
```

Parameters and options:

- `<REQUEST>`: optional positional request text.
- `--request <TEXT|->`: request text; use `-` to read from stdin.
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

Purpose: list skills for the configured skills root.

Syntax:

```bash
devos skills list
```

Output shape:

- If skills exist: one tab-separated line per skill:
  `<name>\t<title>\t<description|->`
- If none exist: `No skills found in <skillsRootPath>`.

### skills add

Purpose: create a new skill document in the configured skills root.

Syntax:

```bash
devos skills add --title "<TITLE>" --description "<DESCRIPTION>" --content "<CONTENT>"
```

Options:

- `--title <TITLE>`: required skill title.
- `--description <DESCRIPTION>`: required skill description.
- `--content <CONTENT>`: required skill body content.

Output shape:

- `Added skill <name> at <path>`.

### skills update

Purpose: update skill metadata/content by skill name.

Syntax:

```bash
devos skills update <NAME> [--title "<TITLE>"] [--description "<DESCRIPTION>"] [--content "<CONTENT>"]
```

Parameters and options:

- `<NAME>`: required skill name.
- `--title <TITLE>`: optional new title.
- `--description <DESCRIPTION>`: optional new description.
- `--content <CONTENT>`: optional new content.

Output shape:

- `Updated skill <name> at <path>`.

Usage notes:

- At least one of `--title`, `--description`, or `--content` is required.

### skills remove

Purpose: remove a skill by name from the configured skills root.

Syntax:

```bash
devos skills remove <NAME>
```

Parameters and options:

- `<NAME>`: required skill name.

Output shape:

- `Removed skill <name> from <path>`.

After linking/installing the package bin, you can also use `devos ...` directly.

### plugins list

Purpose: list bundled CLI plugins.

Syntax:

```bash
devos plugins list [--enabled]
```

Options:

- `--enabled`: show only plugins explicitly enabled in local devos config.

Output shape:

- One tab-separated line per plugin:
  `<id>\t<title>\t<enabled|disabled>`

### plugins show

Purpose: print a bundled plugin template as formatted JSON.

Syntax:

```bash
devos plugins show <PLUGIN_ID>
```

### plugins install

Purpose: show safe install instructions for a bundled plugin.

Syntax:

```bash
devos plugins install <PLUGIN_ID>
```

Usage notes:

- V1 does not execute install commands or remote scripts.
- Templates keep install commands structured for a future trusted installer.

### plugins enable

Purpose: persist a bundled plugin as enabled in local devos config.

Syntax:

```bash
devos plugins enable <PLUGIN_ID>
```

Usage notes:

- Enabled plugin IDs are stored in local sqlite env as `DEVOS_ENABLED_PLUGINS`.
- Codex plugin IDs declared by a template are stored in `CODEX_PLUGINS` and
  passed to Codex as `plugins."<id>".enabled=true`.

### plugins check

Purpose: run local validation checks declared by a bundled plugin template.

Syntax:

```bash
devos plugins check <PLUGIN_ID>
```

Output shape:

- One tab-separated result line per check:
  `<PASS|FAIL>\t<title>\t<expected-or-output>`

## CLI Plugin Templates

CLI plugin templates live under `templates/plugins/`. They are JSON documents
used by `devos plugins list/show/install/enable/check`.

Use [templates/plugins/plugin.template.json](templates/plugins/plugin.template.json)
for new entries. Each template should include:

- `title`: display name shown to operators.
- `description`: short explanation of when to use the plugin.
- `functional`: readable capability list.
- `source`: GitHub repository or script location.
- `install`: install steps as structured `{ "command": "...", "args": [...] }`
  entries.
- `enable`: config, environment, or PATH changes needed to activate it.
- `checks`: validation commands the CLI can run later.
- `tokenOptimization`: how the plugin saves tokens and how to measure it.

RTK is documented as the first token-optimization plugin in
[templates/plugins/rtk-token-optimizer.json](templates/plugins/rtk-token-optimizer.json).
It models a binary plugin: inspect install notes with
`devos plugins install rtk-token-optimizer`, place it on `PATH`, enable it with
`devos plugins enable rtk-token-optimizer`, validate it with
`devos plugins check rtk-token-optimizer`, and opt in by prefixing agent shell
commands with `rtk`.

Keep plugin templates small and declarative. Prefer structured command arrays
over shell strings so future workflow code can execute them without parsing.

## Configuration Notes

- Guided onboarding stores local secrets in `~/.devos/config/env.sqlite` (and writes `.env` for compatibility) and writes `~/.devos/config/instance.config.json` for the local trusted instance.
- Local instance data lives under `~/.devos/instances/default`.
- Docker-isolated Codex execution status and caveats (ROY-95): [docs/RELIABILITY.md#docker-isolated-codex-execution](docs/RELIABILITY.md#docker-isolated-codex-execution)

For runtime config resolution, polling, env vars, and routing behavior, use:

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

<a href="https://www.star-history.com/?repos=0xroylee%2Fdevos.ing&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=0xroylee/devos.ing&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=0xroylee/devos.ing&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=0xroylee/devos.ing&type=date&legend=top-left" />
 </picture>
</a>
