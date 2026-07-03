# Tasks

## 1. Proposal Approval

- [x] Create OpenSpec proposal, spec delta, and task checklist.
- [x] Review `proposal.md` scope with the human owner.
- [x] Decide package-manager convention for `landing/` (`bun`).
- [x] Decide whether to keep the dark visual direction from the downloaded
      export (keep the dark technical direction).
- [x] Decide which GitHub URL the landing page should link to
      (`https://github.com/0xroylee/getsuperpower`).

## 2. Brainstorm Design

- [x] Explore 2-3 landing app structure and styling approaches with trade-offs.
- [x] Confirm the recommended design with the human owner.
- [x] Save the approved design to `docs/superpowers/specs/`.
- [x] Re-review the written design for placeholders, contradictions, and scope
      creep.

## 3. Plan Implementation

- [x] Write the implementation plan in `docs/superpowers/plans/`.
- [x] Include TDD slices for the Next app scaffold, ported components, Tailwind
      setup, metadata, docs, and verification commands.

## 4. Implement With TDD

- [x] Add a failing check or test for the landing page's expected product text
      and workflow cards.
- [x] Create the `landing/` Next.js 16 app scaffold.
- [x] Port the Figma/Vite export into Next.js components.
- [x] Adapt global styling to Tailwind CSS.
- [x] Preserve attribution and add local run instructions.
- [x] Run focused landing checks.

## 5. Verify And Archive

- [x] Run landing app checks.
- [x] Run `rtk bun run check`.
- [x] Run a landing smoke check.
- [x] Record Pony Trail post-change evidence.
- [ ] Run `/opsx:archive` after human approval.
