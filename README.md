<img src="/assets/pony-trail.png" alt="Pony Trail" width="640" />

# Ponytrail

**Every change, on the trail.**

Ponytrail is a small CLI and bundled agent skill for recording why files changed,
showing those changes as a local history tree, and reverting files from a
previous snapshot.

It keeps the trail in `.pony-trail/` inside your project. Treat that folder as
local runtime state; it should stay out of git.

## Set Up Ponytrail

Configure the local bot team, write `.ponytrail/manifest.json`, and install the
bundled skills for Codex, Claude, and Cursor:

```bash
npx ponytrail setup
```

Then start a requirement discussion:

```bash
npx ponytrail ponyrace "add CSV import"
```

## Install The Skill

Install the bundled `pony-trail` skill into your local agent tools:

```bash
npx ponytrail skills install pony-trail
```

Install the bundled `ponyrace` skill to trigger requirement discussion from
agent chat:

```bash
npx ponytrail skills install ponyrace
```

With Bun:

```bash
bunx ponytrail skills install pony-trail
```

Install `ponyrace` with Bun:

```bash
bunx ponytrail skills install ponyrace
```

The installer records a local skill-install snapshot before writing agent skill
files, so the install can be found later in `ponytrail history --details`.

Refresh an installed bundled skill later:

```bash
npx ponytrail skills update pony-trail
```

## Run A Pony Race

Discuss a requirement before implementation:

```bash
npx ponytrail ponyrace "add CSV import"
```

Inside an agent chat, use the same trigger language:

```text
/ponyrace add CSV import
```

The Product Manager, Project Manager, Engineer, and Testing ponies discuss the
direction. The default rule requires 3 of 4 approvals before the human owner can
lock the direction for implementation.

## View History

Show the snapshot tree:

```bash
npx ponytrail history
```

Include action, summary, checks, result, and rollback details:

```bash
npx ponytrail history --details
```

Effect preview:

```text
Snapshot history
* ponytrail-skills
  * skill-install-20260622064256Z-99fa03fd (pre/post)
    action: install skill
    summary: Installed pony-trail skill for claude, copilot, codex
    checks: ponytrail skills install pony-trail --home . --agents claude, copilot, codex
    result: claude:installed, copilot:installed, codex:installed
    rollback: Remove or reinstall the affected agent skill folders, then record another snapshot.
```

Filter to one session or print machine-readable output:

```bash
npx ponytrail history --session <session-id>
npx ponytrail history --json
```

Snapshots are read from:

```text
.pony-trail/
  snapshots.jsonl
  sessions/<session-id>/tree.md
```

## Revert A Snapshot

Preview the planned file actions:

```bash
npx ponytrail revert <snapshot-id> --dry-run
```

Apply the revert:

```bash
npx ponytrail revert <snapshot-id>
```

Ponytrail prints the planned file actions and asks for approval before changing
files. In non-interactive environments, it prints the plan and cancels without
mutating the project.

Revert restores files from the snapshot's `pre` state. If a file did not exist
before the snapshot, Ponytrail deletes it during the revert.

## Local Development

```bash
bun install
bun run build
bun test
bun run check
```
