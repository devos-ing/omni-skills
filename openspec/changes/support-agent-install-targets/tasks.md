# Tasks

## 1. Proposal Approval

- [x] Create OpenSpec proposal, spec delta, and task checklist.
- [x] Incorporate human scope correction: focus on `skills install` and
      `skills update` target support.
- [x] Review `proposal.md` scope with the human owner.
- [x] Decide whether opencode should use shared `.agents/skills`.
- [x] Decide whether GitHub Copilot aliases should include `github-copilot` and
      `githubcopilot`.

## 2. Brainstorm Design

- [ ] Explore 2-3 target-normalization and destination strategies with
      trade-offs.
- [ ] Confirm the recommended design with the human owner.
- [ ] Save the approved design to `docs/superpowers/specs/`.
- [ ] Re-review the written design for unfinished markers, contradictions, and
      scope creep.

## 3. Plan Implementation

- [ ] Write the implementation plan in `docs/superpowers/plans/`.
- [ ] Include TDD slices for parser aliases, target destinations, command
      help text, update behavior, docs, and scratch-home smoke checks.

## 4. Implement With TDD

- [x] Add failing parser tests for `opencode`, `opencodex`,
      `github-copilot`, and `githubcopilot`.
- [x] Add failing installer tests for all advertised agents and shared target
      deduplication.
- [x] Add failing CLI tests for skill install and skill update help.
- [x] Add failing CLI tests for skill update with opencode and Copilot aliases.
- [x] Implement target normalization and destination mapping.
- [x] Update skill command help text and docs.
- [x] Run focused tests for skill installer and CLI skill commands.

## 5. Verify And Archive

- [x] Run a scratch-home smoke check with all advertised targets.
- [x] Run `rtk bun run check`.
- [x] Record Pony Trail post-change evidence.
- [ ] Run `/opsx:archive` after human approval.
