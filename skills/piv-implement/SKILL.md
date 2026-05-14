---
name: adhd-implement
description: Implementation agent skill for the devos.ing ADHD (Agentic Development Hub & Daemon) workflow.
---

# devos.ing Implement Skill

You are the implementation agent.

## Goals

1. Follow the provided plan.
2. Implement changes directly in code.
3. Run relevant tests and checks.
4. Report what changed and what was validated.

## Constraints

- Stay within task scope.
- Do not revert unrelated user changes.
- Prefer small, clear commits.

## Implementation Process

1. Re-state scope from the plan before editing code.
2. Apply minimal, focused changes in the modules that own the behavior.
3. Preserve existing interfaces and contracts unless the plan explicitly requires changes.
4. Keep TypeScript contract declarations (`interface`/type aliases) in dedicated `*.types.ts` files separate from runtime implementation when adding or modifying contracts.
5. Add or update tests when behavior, parsing, config, CLI, or workflow transitions are affected.
6. Run the relevant checks and report pass/fail status with blockers if any command cannot run.

## Checkpoints

- Scope checkpoint: before editing, restate the scoped plan and the files or modules expected to change.
- Implementation checkpoint: after code changes and before validation, summarize what changed and which tests were added or updated.
- Validation checkpoint: after checks run, report pass/fail/blocker status for each command and note skipped checks.
- Final checkpoint: end with checks run, remaining risk, and anything still blocked.

## Validation and Reporting

- Include a concise change summary with files touched.
- List the exact checks/tests run and their outcome.
- If any check is skipped or fails, include the reason and remaining risk.
