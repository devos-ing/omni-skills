# PonyTrail

PonyTrail is a requirement-first command-line runtime for supervising AI workers. It helps a human owner turn a loose request into a visible court-style discussion, a locked requirement, and installable agent skills for Claude, Codex, and GitHub Copilot.

Purpose: make agent decisions easy to track like git. PonyTrail records why an agent changed files, groups snapshots into session commit trees, and keeps enough evidence to understand or revert a change later.

The current npm package is `goal-court` and the current CLI binary is `goal-court`.

## Install

Install the default PonyTrail skill, `pony-trail`, into Claude, GitHub Copilot/shared agents, and Codex:

```bash
npx goal-court skills install pony-trail
```

or with Bun:

```bash
bunx goal-court skills install pony-trail
```

Install for one agent target:

```bash
npx goal-court skills install pony-trail --agents claude
npx goal-court skills install pony-trail --agents codex
npx goal-court skills install pony-trail --agents copilot
```

Preview destinations before writing files:

```bash
npx goal-court skills install pony-trail --dry-run
```

Install the skill and add a PonyTrail prehook reminder so file-editing tools automatically receive PonyTrail context:

```bash
npx goal-court skills install pony-trail --prehook
```

Overwrite an existing installed copy:

```bash
npx goal-court skills install pony-trail --force
```

Install destinations:

| Agent | Destination |
| --- | --- |
| Claude | `~/.claude/skills/pony-trail` |
| Codex | `~/.codex/skills/pony-trail` |
| GitHub Copilot/shared agents | `~/.agents/skills/pony-trail` |

## How It Works

PonyTrail separates requirement discussion from worker execution:

1. A human gives a request.
2. PonyTrail checks whether the request is clear enough.
3. Product, project, engineering, and testing bots discuss the requirement.
4. The voting bots approve or request amendments.
5. A non-voting Judge summarizes the direction.
6. Human confirmation stays required before worker execution.
7. Worker adapters for Codex, Claude, or GitHub Copilot remain behind plugin seams.
8. Evidence such as decisions, file changes, commands, checks, and rollback notes is collected append-only.

The bundled `pony-trail` skill makes file changes auditable. It records pre-change intent and post-change results in `.agent-change-snapshots/`, including file hashes, small before/after copies, and per-session commit trees at `.agent-change-snapshots/sessions/<session-id>/tree.md`.

## Commands

```bash
goal-court --help
goal-court onboard
goal-court bots
goal-court goal "Add CSV import to the admin dashboard"
goal-court vote --votes '[...]'
goal-court stream-goal "Review checkout test plan evidence"
goal-court skills install pony-trail
```

Common options:

```bash
goal-court onboard --dir . --name "My Project" --yes
goal-court bots --manifest .goal-court/manifest.json
goal-court goal "Add CSV import to the admin dashboard" --json
goal-court skills install pony-trail --agents claude,codex --dry-run
goal-court skills install pony-trail --prehook
goal-court skills install ./path/to/local-skill --force
```

`stream-goal` is currently a compatibility alias for requirement discussion. It does not silently launch a worker.

## Development

Install dependencies:

```bash
bun install
```

Run the CLI locally:

```bash
bun run dev -- --help
bun run dev -- onboard --dir work/smoke-runtime --name "Smoke Runtime" --yes
bun run dev -- bots --manifest work/smoke-runtime/.goal-court/manifest.json
bun run dev -- goal "Add CSV import to the admin dashboard"
```

Build the package CLI:

```bash
bun run build
bun dist/cli.js --help
```

Run checks:

```bash
bun test
bun run typecheck
bun run check
```

Codex in this workspace should prefix commands with `rtk`:

```bash
rtk bun run check
```

Project layout:

| Path | Purpose |
| --- | --- |
| `src/cli.ts` | Thin Commander CLI shell |
| `src/runtimes/goal-court/` | Requirement-first runtime, manifest validation, goal drafting, and voting |
| `src/plugins/adapters/` | Codex, Claude, and GitHub Copilot worker adapter seams |
| `src/skills/` | Reusable skill and bot capability contracts |
| `bundled-skills/` | Skills packaged with the CLI installer |
| `tests/` | Bun tests for runtime behavior and CLI registration |

## FAQs

### Is the project called PonyTrail or Goal Court?

The product name is PonyTrail. The current package is `goal-court`, and the current binary is `goal-court`.

### What does `skills install` install?

By default, it installs `pony-trail`, a skill that records why files changed, what changed, how it was verified, and how to roll it back.

### Does PonyTrail support Claude, Codex, and GitHub Copilot?

Yes. The installer can write skills to Claude (`~/.claude/skills`), Codex (`~/.codex/skills`), and GitHub Copilot/shared agent skills (`~/.agents/skills`). Worker adapter seams also exist under `src/plugins/adapters/`.

### Does `goal` execute an AI worker?

No. `goal` runs requirement clarification and visible court discussion. Worker execution is gated behind approval and human confirmation.

### Can I install a local skill folder?

Yes:

```bash
goal-court skills install ./path/to/skill --agents claude,codex
```

The folder must contain a `SKILL.md` with valid frontmatter.

### Do snapshots replace git?

No. Snapshots explain the reason, purpose, verification, and rollback context for file changes. Git still handles version control and reversions when available. PonyTrail adds a git-like decision tree so you can see the agent's commits of intent even when the workspace is not a git repo.

### Where is the session tree?

Each snapshot belongs to a session. The shell helper writes:

```text
.agent-change-snapshots/sessions/<session-id>/commits.jsonl
.agent-change-snapshots/sessions/<session-id>/tree.md
```

Set `PONYTRAIL_SESSION_ID` or pass `--session-id <id>` to group related changes into the same tree. `DEVCOURT_SESSION_ID` remains supported as a legacy fallback.

### Why does the snapshot helper use `sh`?

The current helper is `scripts/snapshot_change.sh`, so agents can record snapshots without depending on Python. A Python helper remains for older installed environments that already call it.

### What does `--prehook` do?

`--prehook` installs a small PonyTrail hook script and merges a `PreToolUse` hook into the selected agent settings. The hook adds context before mutation-prone tools so the agent remembers to use `$pony-trail` before and after file changes. It preserves existing hooks.
