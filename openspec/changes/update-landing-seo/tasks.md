# Tasks

## 1. Proposal Approval

- [x] Create OpenSpec proposal, spec delta, and task checklist.
- [x] Review `proposal.md` scope with the human owner.
- [x] Confirm canonical URL for the landing page
      (`https://github.com/0xroylee/getsuperpower`).
- [x] Confirm whether this pass should stay text-only for social previews.

## 2. Brainstorm Design

- [x] Explore metadata approaches with trade-offs.
- [x] Confirm the recommended SEO design with the human owner.
- [x] Save the approved design to `docs/superpowers/specs/`.
- [x] Re-review the written design for placeholders, contradictions, and scope
      creep.

## 3. Plan Implementation

- [x] Write the implementation plan in `docs/superpowers/plans/`.
- [x] Include TDD slices for metadata verification, layout metadata updates,
      and landing/root verification commands.

## 4. Implement With TDD

- [x] Confirm the public testing seam for exported landing metadata.
- [x] Add a failing metadata test or check.
- [x] Update `landing/app/layout.tsx` metadata.
- [x] Run the focused metadata test or check.
- [x] Run landing checks from `landing/`.
- [x] Run root checks from the repository root.

## 5. Verify And Archive

- [x] Record Pony Trail post-change evidence for implementation changes.
- [ ] Run `/opsx:archive` after human approval.
