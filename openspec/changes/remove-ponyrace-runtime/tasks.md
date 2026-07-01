# Tasks

## 1. Approve Removal Boundary

- [x] Review `proposal.md` with the human owner.
- [x] Confirm package/binary naming decision.
- [x] Confirm whether `bundle` and `workflow` aliases stay for one transition
      period.

## 2. Deepen Design With Superpowers

- [x] Map current command surfaces to keep/remove decisions.
- [x] Map source files to keep/remove decisions.
- [x] Decide final module layout for surviving bundle-skill code.
- [x] Get explicit human approval before implementation.

## 3. Plan The Implementation

- [x] Write a Superpowers implementation plan with TDD slices.
- [x] Include exact test removals, replacements, and smoke commands.
- [x] Preserve acceptance criteria from `specs/getsuperpower-only/spec.md`.

## 4. Remove Ponyrace Runtime

- [x] Remove Ponyrace-only CLI commands.
- [x] Remove requirement-court, goal, voting, report, and worker-runner modules.
- [x] Remove Ponyrace-only bundled skills and tests.
- [x] Keep or relocate bundle-skill modules.

## 5. Update Docs And Examples

- [x] Make README GetSuperpower-first and remove Ponyrace primitive copy.
- [x] Update architecture docs to describe the bundle-skill-only product.
- [x] Keep author guide and examples aligned with current commands.

## 6. Verify And Archive

- [x] Run focused red/green tests for the new command surface.
- [x] Run `rtk bun run check`.
- [x] Record Ponytrail post-change evidence.
- [ ] Archive the accepted behavior back into specs/project knowledge.
