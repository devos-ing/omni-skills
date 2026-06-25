<img src="/assets/ponyrace.png" alt="Ponyrace" width="640" />

# Ponyrace

Run a quick requirement race before an AI agent starts implementing.

Ponyrace onboards a project, installs bundled agent skills for Codex, Claude,
GitHub Copilot, and Cursor targets, then lets role ponies review whether a
requirement direction matches what the human actually wants.

Common commands include `ponyrace onboard`, `ponyrace setup`,
`ponyrace ponyrace "<request>"`, `ponyrace history`, `ponyrace revert`, and
`ponyrace skills`.

## The Basic Workflow

1. Onboard the project with `npx ponyrace onboard` or
   `bunx ponyrace onboard`, or use `npx ponyrace setup` when you want to
   configure the review ponies.
2. Restart your agent IDE so the bundled `/ponyrace` skill is loaded.
3. Start a requirement discussion with `/ponyrace <request>` in agent chat, or
   run `npx ponyrace ponyrace "<request>"` from a shell.
4. Read the role-pony discussion, Judge summary, approval tally, and detailed
   requirement.
5. Give explicit human approval only when the requirement direction matches what
   you want built.
6. Use the approved requirement with your implementation agent. Ponyrace keeps
   worker execution gated instead of starting it automatically, and leaves the
   report and local history available for review or rollback.

## Onboard

```bash
npx ponyrace onboard
```

Or with Bun:

```bash
bunx ponyrace onboard
```

Onboarding writes `.ponyrace/manifest.json` and `.ponyrace/README.md`, creates
local runtime folders, installs the bundled skills, and records the install in
local history. By default, onboard installs for Claude, GitHub Copilot, and
Codex; pass `--agents claude,copilot,codex,cursor` to choose explicit targets,
including Cursor. Restart your agent IDE after onboarding so the chat command is
loaded.

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

Final votes
product_manager_bot: approve (0.8)
project_manager_bot: approve (0.8)
engineer_bot: approve (0.8)
testing_bot: approve (0.8)

Detailed requirement
Title: add CSV import to the admin dashboard
Intent: add CSV import to the admin dashboard
What will change:
- add CSV import to the admin dashboard
Acceptance criteria:
- Human owner confirms the detailed requirement matches this request...
Evidence required:
- raw_human_request
- requirements_brainstorm
- role_bot_discussion
- bot_votes
- judge_summary
- human_decision
- locked_goal_contract

Human confirmation: pending
Markdown report: outputs/ponyrace/<timestamp>-add-csv-import-to-the-admin-dashboard.md
```

Outside agent chat, run the same discussion directly:

```bash
npx ponyrace ponyrace "add CSV import to the admin dashboard"
```

For an evidence-backed race, ask the configured worker CLI to run each review
pony through the manifest skills before voting:

```bash
npx ponyrace ponyrace --research --worker codex "add CSV import to the admin dashboard"
```

By default, `ponyrace ponyrace` writes a Markdown report under
`outputs/ponyrace/`. Use `--markdown <path>` to choose a report path,
`--skip-markdown` to skip the report, or `--json` for machine-readable output.
The default race uses Ponyrace's explicit local pony runner; `--research` uses
the selected worker adapter, requires each pony to return evidence, and prints
that evidence in the visible thinking transcript and Markdown report.

## Quality Metrics

Ponyrace improves the result by making requirement quality visible before code
changes begin:

| Metric | What It Shows |
| --- | --- |
| Role coverage | Product, project, engineering, and testing perspectives all reviewed the direction. |
| Approval tally | The default gate needs 3 of 4 approvals before the human can lock the goal. |
| Confidence | Each pony reports a confidence score, so weak agreement is easy to spot. |
| Evidence | Researched races show the facts, context, or named unknowns behind each pony vote. |
| Required changes | Amend/reject votes carry concrete changes instead of vague objections. |
| Human gate | `Human confirmation: pending` keeps implementation blocked until the owner approves. |

Use the approval tally, confidence scores, and required changes as the immediate
quality signal for whether the agent should proceed or the requirement should be
rewritten.

## Local Trail

Ponyrace keeps local runtime and evidence files out of your source tree:

```text
.ponyrace/
  manifest.json
  goals/
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
