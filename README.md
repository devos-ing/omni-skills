<img src="/assets/ponyrace.png" alt="Ponyrace" width="640" />

# Ponyrace

Run a quick requirement race before an AI agent starts implementing.

Ponyrace onboards a project, installs the bundled `/ponyrace` chat trigger for
Codex and Claude, then lets role ponies review whether a requirement direction
matches what the human actually wants.

Use `ponyrace` for new commands, including `ponyrace ponyrace "<request>"`,
`ponyrace history`, and `ponyrace revert`.

## Onboard

```bash
npx ponyrace onboard
```

Or with Bun:

```bash
bunx ponyrace onboard
```

Onboarding writes `.ponytrail/manifest.json`, installs the bundled skills, and
records the install in local history. Restart Codex or Claude after onboarding so
the chat command is loaded.

## Run A Race

Inside Codex or Claude:

```text
/ponyrace add CSV import to the admin dashboard
```

Preview:

```text
Pony race

Round 1
product_manager_bot: I think this preserves the user's product intent...
project_manager_bot: I think this can become a manageable unit of work...
engineer_bot: I think the requirement is technically feasible...
testing_bot: I think this needs observable acceptance criteria...

Visible thinking transcript
Round 1
Product Manager Bot (product_manager_bot)
Focus: Discuss whether the requirement preserves user value and scope.
Vote: approve (80% confidence)

Judge summary
Approvals: 4/4. Verdict: approved.

Detailed requirement
Title: add CSV import to the admin dashboard
What will change:
- add CSV import to the admin dashboard
Evidence required:
- raw_human_request
- role_bot_discussion
- bot_votes
- judge_summary
- human_decision

Human confirmation: pending
```

Outside agent chat, run the same discussion directly:

```bash
npx ponyrace ponyrace "add CSV import to the admin dashboard"
```

## Quality Metrics

Ponyrace improves the result by making requirement quality visible before code
changes begin:

| Metric | What It Shows |
| --- | --- |
| Role coverage | Product, project, engineering, and testing perspectives all reviewed the direction. |
| Approval tally | The default gate needs 3 of 4 approvals before the human can lock the goal. |
| Confidence | Each pony reports a confidence score, so weak agreement is easy to spot. |
| Required changes | Amend/reject votes carry concrete changes instead of vague objections. |
| Human gate | `Human confirmation: pending` keeps implementation blocked until the owner approves. |

Use the approval tally, confidence scores, and required changes as the immediate
quality signal for whether the agent should proceed or the requirement should be
rewritten.

## Local Trail

Ponyrace keeps local runtime and evidence files out of your source tree:

```text
.ponytrail/
  manifest.json
  goals/

.pony-trail/
  snapshots.jsonl
  sessions/<session-id>/tree.md
```

Useful commands:

```bash
npx ponyrace history --details
npx ponyrace revert <snapshot-id> --dry-run
```

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