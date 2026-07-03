# Tasks

## 1. Proposal Approval

- [x] Create OpenSpec proposal, spec delta, and task checklist.
- [x] Review `proposal.md` scope with the human owner.
- [x] Decide whether the v1 run demo should animate automatically or stay
      mostly static.
- [x] Decide where the "simulated run" disclosure should appear.

## 2. Brainstorm Design

- [x] Explore 2-3 section layouts with trade-offs.
- [x] Confirm the recommended design with the human owner.
- [x] Save the approved design to `docs/superpowers/specs/`.
- [x] Re-review the written design for unfinished markers, contradictions, and
      scope creep.

## 3. Plan Implementation

- [x] Write the implementation plan in `docs/superpowers/plans/`.
- [x] Include TDD slices for workflow-run content, component rendering, landing
      placement, responsive layout, and verification.

## 4. Implement With TDD

- [x] Add failing landing source-contract tests for the workflow-run section.
- [x] Add typed workflow-run phase content in `landing/lib/landing-content.ts`.
- [x] Add a focused `WorkflowRunDemo` component.
- [x] Wire the section into `landing/components/landing-page.tsx`.
- [x] Preserve existing landing behavior and source attribution tests.

## 5. Verify And Archive

- [x] Run focused landing tests.
- [x] Run landing app typecheck/build or equivalent smoke checks.
- [x] Run `rtk bun run check`.
- [x] Accept visual smoke limitation after sandbox blocked Playwright desktop/mobile screenshots.
- [x] Record Pony Trail post-change evidence.
- [x] Run `/opsx:archive` after human approval.
