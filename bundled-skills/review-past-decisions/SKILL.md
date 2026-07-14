---
name: review-past-decisions
description: Use before drafting, revising, or executing a plan when prior decisions, snapshots, specs, issue comments, or other project history may constrain the new plan; review past decisions and carry forward accepted constraints, rejected approaches, open questions, and plan implications.
---

# Review Past Decisions

## Overview

Review prior decision evidence before proposing a new plan. Use this skill when the next plan may be shaped by earlier approvals, rejected approaches, snapshot history, specs, issue comments, or local project notes.

Core principle: plans should carry forward known decisions instead of rediscovering or contradicting them.

## Decision Review Flow

1. Name the current planning question in one sentence.
2. Inspect relevant local evidence before planning:
   - normal-install workflow records under `~/.omniskills/workflows/`
   - project-local `.omniskills/workflows/` records only when the workflow command used `--dir`
   - accepted specs, prior plans, docs, issue notes, or review comments in the workspace
3. Extract only decisions that can affect the new plan.
4. Mark stale, missing, or conflicting evidence instead of guessing.
5. Use the carry-forward to shape the new plan.

## Required Output

Before presenting the new plan, write a short decision carry-forward:

```markdown
Decision carry-forward:
- Preserve:
- Active constraints:
- Avoid:
- Needs confirmation:
- Plan implications:
```

If no relevant evidence exists, write: `No relevant prior decision evidence found.` Then continue with the current request and context.

## Guardrails

- Do not invent past decisions.
- Do not treat stale evidence as binding without saying it may be stale.
- Do not review unrelated history just because it exists.
- Do not turn this into a long research report; keep the carry-forward short and decision-focused.
- If a prior decision conflicts with the user's newest request, say so and ask for confirmation before relying on the older decision.
