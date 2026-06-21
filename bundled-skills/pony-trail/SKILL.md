---
name: pony-trail
description: Use when an agent is about to create, edit, move, or delete files and must preserve decision snapshots, action rationale, file-change intent, rollback context, or a git-like audit trail for every file mutation.
---

# PonyTrail

## Overview

Create a small audit trail around every file mutation: why it exists, which files should change, how to verify it, and how to roll it back. Snapshots complement git; they do not replace git. Each session also gets a git-like commit tree so agent decisions can be tracked and reverted by purpose.

Core principle: no file edit without a pre-change decision snapshot and a post-change result snapshot.

## Mandatory Flow

1. Before mutating files, record a pre-change snapshot with action, purpose, reason, files, expected outcome, verification, and rollback.
2. Make the smallest planned mutation.
3. Immediately record a post-change snapshot with what changed, verification result, and any follow-up.
4. If the next file has a different reason or purpose, start a new snapshot instead of stretching the old one.
5. If an unplanned file changes, pause and snapshot it before further edits.
6. Use git for reversions when available; use snapshots to know why and what to revert.

## Helper Script

Use `scripts/snapshot_change.sh` from this skill directory. It writes JSONL under `.agent-change-snapshots/`, stores file hashes plus small before/after copies, and appends a per-session git-like tree under `.agent-change-snapshots/sessions/<session-id>/tree.md` without requiring Python. `scripts/snapshot_change.py` remains available for older environments that already call it.

Pre-change:

```bash
sh /path/to/pony-trail/scripts/snapshot_change.sh pre \
  --session-id "${PONYTRAIL_SESSION_ID:-default}" \
  --files src/example.ts \
  --action "edit validation" \
  --purpose "Reject empty names before saving" \
  --reason "The current flow accepts invalid input" \
  --expected "Validation returns a clear error" \
  --verify "Run the focused validation test" \
  --rollback "Revert src/example.ts or restore the pre snapshot"
```

Post-change:

```bash
sh /path/to/pony-trail/scripts/snapshot_change.sh post \
  --session-id "${PONYTRAIL_SESSION_ID:-default}" \
  --snapshot-id 20260621T120000Z-abc12345 \
  --files src/example.ts \
  --summary "Added empty-name guard and test coverage" \
  --checks "bun test tests/example.test.ts" \
  --result "pass"
```

The pre command prints the `snapshot_id` to reuse in the post command. It also prints the session tree path. With git, records include branch and commit. Without git, hashes, stored copies, and the session tree become the main local evidence.

Session tree:

```text
.agent-change-snapshots/
  snapshots.jsonl
  sessions/<session-id>/
    commits.jsonl
    tree.md
```

Use `--session-id <id>` or set `PONYTRAIL_SESSION_ID`. The legacy `DEVCOURT_SESSION_ID` still works as a fallback. If neither is set, the helper writes to `default`.

## What To Capture

| Field | Meaning |
| --- | --- |
| Action | create, edit, move, delete, format, generate |
| Purpose | User or system outcome served |
| Reason | Why this action is right now |
| Files | Exact expected files or directories |
| Expected | What should be true afterward |
| Verify | Command, inspection, or smoke check |
| Rollback | Smallest practical revert path |

## Rationalization Traps

- "This is a tiny edit." Tiny edits still need a reason and rollback note.
- "Git diff is enough." Diff shows what changed, not why the agent chose it.
- "I will summarize at the end." End summaries lose per-action intent.
- "The formatter will only touch what I expect." Snapshot before running mutating tools.
- "The workspace is not a git repo." That makes snapshots more important, not less.

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| One snapshot covers unrelated edits | Split by purpose |
| Snapshot after editing only | Create a pre snapshot first; post-only records miss the original state |
| Vague purpose like "fix bug" | Name the observable outcome |
| No rollback plan | State the file-level revert or restore path before editing |
| Ignoring generated files | Snapshot before generation and list expected outputs |

## Baseline Failure Pattern

Without this skill, agents tend to edit directly, then rely on a final summary or `git diff`. Under pressure they call the change "small" or "obvious" and skip per-action intent. This skill makes the decision snapshot part of the edit ritual.
