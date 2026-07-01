---
name: opsx-handoff-review
description: Use when an OpenSpec proposal, tasks.md handoff, or archive checkpoint must stay aligned with a Superpowers implementation workflow.
---

# OpenSpec Handoff Review

Use this skill to keep the OpenSpec side of a GetSuperpower explicit while
Superpowers owns design, build, and verification.

## Quick Reference

| Checkpoint | Confirm |
| --- | --- |
| `/opsx:propose` | `proposal.md`, `specs/`, and `tasks.md` exist |
| Human review | `proposal.md` scope and design direction are approved |
| Handoff | `tasks.md` preserves acceptance criteria and relevant `specs/` paths |
| Delivery | Superpowers returns changed files, checks, and verification evidence |
| `/opsx:archive` | Final behavior is merged back into specs and project knowledge |

## Common Mistakes

- Starting Superpowers planning before the human owner approves `proposal.md`.
- Treating `tasks.md` as a loose note instead of the scope handoff contract.
- Archiving before verification evidence is available.
