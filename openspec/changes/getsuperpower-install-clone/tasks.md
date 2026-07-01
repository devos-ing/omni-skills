# Tasks

## 1. Proposal Approval

- [x] Create OpenSpec proposal, spec delta, and task checklist.
- [x] Review the command vocabulary with the human owner.
- [x] Confirm whether `clone` output should say "installed" or "cloned".
- [x] Confirm the preferred public phrase: "bundle skills set", "skill bundle",
      or "GetSuperpower".

## 2. Brainstorm Design

- [x] Explore current CLI command registration and docs.
- [x] Present 2-3 command-model approaches with trade-offs.
- [x] Get explicit design approval before implementation.
- [x] Save the approved design to `docs/superpowers/specs/`.

## 3. Plan Implementation

- [x] Write the implementation plan in `docs/superpowers/plans/`.
- [x] Include TDD slices for command registration, install/clone behavior, docs,
      and smoke checks.

## 4. Implement With TDD

- [x] Add a failing CLI test for `getsuperpower clone <source>`.
- [x] Implement `clone` as a first-class install-compatible command.
- [x] Update help expectations and command registration tests.
- [x] Update README and workflow examples to teach install/clone.
- [x] Preserve compatibility aliases.

## 5. Verify And Archive

- [x] Run focused tests for `getsuperpower` command behavior.
- [x] Run `rtk bun run check`.
- [x] Record Pony Trail post-change evidence.
- [ ] Run `/opsx:archive` after human approval.
