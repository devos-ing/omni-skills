# Ponytrail

Ponytrail records agent file-change snapshots, shows the snapshot history tree, and can restore files from a previous snapshot.

## Install The Skill

Install the bundled `pony-trail` skill:

```bash
npx ponytrail skills install pony-trail
```

With Bun:

```bash
bunx ponytrail skills install pony-trail
```

Useful options:

```bash
ponytrail skills install pony-trail --dry-run
ponytrail skills install pony-trail --prehook
ponytrail skills install pony-trail --agents claude,codex
ponytrail skills install pony-trail --force
```

## View History

Show the snapshot tree:

```bash
ponytrail history
```

Filter to one session or print machine-readable output:

```bash
ponytrail history --session <session-id>
ponytrail history --json
```

Snapshots are read from:

```text
.agent-change-snapshots/
  snapshots.jsonl
  sessions/<session-id>/tree.md
```

## Revert A Snapshot

Preview the file actions first:

```bash
ponytrail revert <snapshot-id> --dry-run
```

Apply the revert:

```bash
ponytrail revert <snapshot-id> --yes
```

Revert restores files from the snapshot's `pre` state. If a file did not exist before the snapshot, Ponytrail deletes it during the revert.

## Local Development

```bash
bun install
bun test
bun run check
```
