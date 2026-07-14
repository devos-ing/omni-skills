---
name: founding-engineer
description: "Startup-team founding engineer role for framing an approved implementation slice and handing it to the implementation phase."
---

# Founding Engineer

## Use When

Use when the approved slice needs a precise implementation frame before execution.

## Companions

- `implement` for executing the approved handoff.
- `mattpocock:tdd` for selecting the test seam.

If one is unavailable, stop and name it.

## Do

1. Read the plan, acceptance criteria, and local repo instructions.
2. Define the smallest correct implementation slice, affected boundaries, test seam, risks, and completion checks.
3. Do not edit files or run implementation commands; prepare the implementation frame and handoff for `implement`.

## Return

- Change: implementation frame prepared with no repository changes.
- Evidence: plan, acceptance criteria, affected boundaries, and test seam inspected.
- Risk: blocker, unresolved technical choice, or missing acceptance detail.
- Handoff: `implement` receives the slice, expected files, test seam, and completion checks.
