# Tasks

## 1. Proposal Approval

- [x] Create OpenSpec proposal, spec delta, and task checklist.
- [x] Incorporate visual companion selection B: show the workflow diagram
      in-page first.
- [x] Review `proposal.md` scope with the human owner.
- [x] Decide where the selected workflow detail appears on desktop and mobile
      (right-side detail panel on desktop, stacked below cards on mobile).
- [x] Decide whether GitHub source links open in the same tab or a new tab
      (new tab).
- [x] Decide whether OpenSpec Delivery is selected by default (wait until the
      visitor clicks a workflow).

## 2. Brainstorm Design

- [x] Explore 2-3 workflow-detail layout approaches with trade-offs.
- [x] Confirm the recommended design with the human owner.
- [x] Save the approved design to `docs/superpowers/specs/`.
- [x] Re-review the written design for unfinished markers, contradictions, and
      scope creep.

## 3. Plan Implementation

- [x] Write the implementation plan in `docs/superpowers/plans/`.
- [x] Include TDD slices for content metadata, card interaction, selected detail
      state, workflow diagram rendering, GitHub source links, search behavior,
      and landing verification.

## 4. Implement With TDD

- [x] Add failing landing source-contract tests for workflow detail metadata and
      GitHub source URLs.
- [x] Add failing tests or checks that "View workflow" is actionable and not
      passive text.
- [x] Extend `landing/lib/landing-content.ts` with workflow slugs, source URLs,
      and ordered diagram steps.
- [x] Update `landing/components/workflow-card.tsx` to expose an actionable
      card control.
- [x] Add a workflow detail/diagram component.
- [x] Wire selected-workflow state in `landing/components/landing-page.tsx`.
- [x] Keep search behavior coherent when the selected workflow is filtered.
- [x] Run focused landing tests and type checks.

## 5. Verify And Archive

- [x] Run landing app typecheck and build checks.
- [x] Run `rtk bun run check`.
- [x] Smoke the landing page in desktop and mobile viewports.
- [x] Record Pony Trail post-change evidence.
- [ ] Run `/opsx:archive` after human approval.
