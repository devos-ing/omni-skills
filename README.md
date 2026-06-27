<img src="/assets/ponyrace.png" alt="Ponyrace" width="640" />

# Ponyrace

Run a quick requirement check before an AI agent starts coding.

Ponyrace installs a `/ponyrace` chat command for your agent. When you use it,
role ponies review the request, a Judge summarizes the votes, and you get a
clear requirement to approve before implementation starts.

Ponyrace does not implement code by itself. It helps you decide whether the
agent should proceed, revise the request, or stop.

## Quick Start

In the project where your agent will work:

```bash
npx ponyrace onboard
```

Use `setup` instead if you want to choose the review ponies, models, or approval
threshold:

```bash
npx ponyrace setup
```

Restart your agent IDE so Codex, Claude, Cursor, or GitHub Copilot loads the
new `/ponyrace` skill.

Then start a race from agent chat:

```text
/ponyrace add CSV import to the admin dashboard. Scope: admin import only. Evidence: tests and one smoke import.
```

Or run the same discussion from a shell:

```bash
npx ponyrace ponyrace "add CSV import to the admin dashboard. Scope: admin import only. Evidence: tests and one smoke import."
```

Read the result:

- If it says `approved`, review the detailed requirement and explicitly tell
  your implementation agent to proceed.
- If it says `not approved`, or if any pony votes `amend` or `reject`, rewrite
  the request with the requested changes and run another race.

## Good Requests

Use this shape:

```text
/ponyrace <outcome>. Scope: <what is included or excluded>. Evidence: <checks that prove it works>.
```

Examples:

```text
/ponyrace fix the login redirect loop. Scope: redirect handling only. Evidence: regression test and auth smoke check.
```

```text
/ponyrace add CSV import to the admin dashboard. Scope: upload, parse, validation, and result UI. Evidence: parser tests, validation tests, and one smoke import.
```

Ponyrace uses local deterministic pony review by default. To run external
worker-backed research, opt in with `--research` and pick the worker CLI that
may receive the requirement plus private repo, tool, and dirty-worktree context:

```bash
npx ponyrace ponyrace --research --worker codex "review the refund webhook plan. Scope: tests only, no live refunds. Evidence: refund fixture and dry-run smoke output."
```

Use `--no-research` when you want to make the local-only choice explicit.

## What Ponyrace Prints

You should see:

- role pony discussion
- approval tally
- Judge summary
- final votes
- detailed requirement
- `Human confirmation: pending`

`Human confirmation: pending` means implementation is still blocked until you
explicitly approve the detailed requirement.

By default, Markdown reports are saved under `.ponyrace/ponyrace/`.

## Common Commands

| Command | Purpose |
| --- | --- |
| `npx ponyrace onboard` | Create `.ponyrace/` files and install default skills. |
| `npx ponyrace setup` | Configure ponies, models, approval threshold, and skills. |
| `npx ponyrace ponyrace "<request>"` | Run a requirement race from the shell. |
| `npx ponyrace skills install pony-trail` | Install only the file-change history skill. |
| `npx ponyrace history` | Show local snapshot history. |
| `npx ponyrace history --details` | Show detailed snapshot metadata. |
| `npx ponyrace revert <snapshot-id> --dry-run` | Preview restoring files from a snapshot. |

## Local Files

Ponyrace writes local project state under `.ponyrace/`:

```text
.ponyrace/
  manifest.json
  ponyrace/
  snapshots.jsonl
  sessions/
```

Keep `.ponyrace/` out of git unless you intentionally want to share project
policy or generated reports.

## Local Development

```bash
bun install
bun run build
bun test
bun run check
```

## Migration: 0.2.0

Version `0.2.0` renames the package and CLI binary from `ponytrail` to
`ponyrace`.

```bash
npx ponytrail onboard
# becomes
npx ponyrace onboard

bunx ponytrail onboard
# becomes
bunx ponyrace onboard
```
