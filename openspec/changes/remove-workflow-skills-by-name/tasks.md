# Tasks

## 1. Proposal Approval

- [x] Create OpenSpec proposal, spec delta, and task checklist.
- [x] Review `proposal.md` scope with the human owner.
- [x] Confirm the public command spelling: `getsuperpower remove <workflow-name>`.
- [x] Confirm the compatibility alias: `getsuperpower workflow remove <workflow-name>`.
- [x] Confirm the safety behavior for shared artifacts and legacy records.

## 2. Brainstorm Design

- [x] Explore record-only, legacy-inference, and installer-owned removal
      strategies with trade-offs.
- [x] Confirm the recommended design with the human owner.
- [x] Save the approved design to `docs/superpowers/specs/`.
- [x] Re-review the written design for unfinished markers, contradictions, and
      scope creep.

## 3. Plan Implementation

- [x] Write the implementation plan in `docs/superpowers/plans/`.
- [x] Include TDD slices for command registration, workflow-record metadata,
      dry-run output, shared-artifact protection, legacy fallback behavior, and
      scratch-home smoke checks.

## 4. Implement With TDD

- [x] Add failing registration tests for `remove` and `workflow remove`.
- [x] Add failing workflow-runtime tests for reading, planning, and deleting a
      named installed workflow record.
- [x] Add failing install tests proving workflow records capture exact skill
      artifact metadata.
- [x] Add failing CLI tests for dry-run, missing workflow, confirmed removal,
      shared-artifact preservation, and legacy fallback output.
- [x] Implement workflow-record metadata persistence.
- [x] Implement remove planning and artifact deletion through runtime/plugin
      seams.
- [x] Wire root and compatibility remove commands.
- [x] Update help text and architecture/docs references.
- [x] Run focused tests after each vertical slice.

## 5. Verify And Archive

- [x] Run a scratch-home install/remove smoke check under `work/`.
- [x] Run `rtk bun run check`.
- [x] Record Pony Trail post-change evidence.
- [ ] Run `/opsx:archive` after human approval.
