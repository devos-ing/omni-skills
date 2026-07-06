# Tasks

## 1. Proposal Review

- [x] Inspect the downloaded reference folder.
- [x] Inspect the current landing app structure and existing OpenSpec landing
      spec.
- [x] Create this OpenSpec proposal, spec delta, and task handoff.
- [x] Review `proposal.md` scope with the human owner.
- [x] Confirm the workflow section label: "Workflow Registry" while placeholder
      metrics are hidden.
- [x] Confirm that install counts should be hidden until real data exists.
- [x] Confirm that activity signals should be hidden until real data exists.
- [x] Confirm that workflow detail pages should show and copy install commands.

## 2. Brainstorm Design

- [x] Offer the visual companion before visual design questions.
- [x] Explore 2-3 workflow browsing approaches with trade-offs.
- [x] Confirm the recommended design with the human owner.
- [x] Update `landing/design.md` from the approved reference direction.
- [x] Re-review the written design for unfinished markers, contradictions, and
      scope creep.
- [x] Ask the human owner to approve the written design before implementation.

## 3. Plan Implementation

- [x] Confirm public test seams for the TDD pass.
- [x] Write an implementation plan in `docs/superpowers/plans/`.
- [x] Include TDD slices for design-doc coverage, hidden placeholder metrics,
      search behavior, route links, responsive row layout, and
      existing behavior preservation.
- [x] Include a TDD slice for copyable install commands on workflow detail
      pages.

## 4. Implement With TDD

- [x] Add failing source-contract tests for the `landing/design.md` reference
      direction.
- [x] Add failing source-contract tests that placeholder workflow metrics are
      not shown without real data.
- [x] Add failing source-contract tests for the workflow registry label and
      browsing surface.
- [x] Add failing source-contract tests that workflow entries link to
      `/workflows/[slug]`.
- [x] Add failing source-contract tests that detail pages render copyable
      install commands.
- [x] Keep `landing/lib/landing-content.ts` free of placeholder activity and
      install metric metadata while real data is unavailable.
- [x] Refactor `landing/components/workflow-card.tsx` or add a focused
      workflow row component.
- [x] Refactor `landing/components/landing-page.tsx` to render the approved
      workflow browsing surface.
- [x] Add a small client component for copyable workflow detail install
      commands.
- [x] Wire the copyable install command into workflow detail routes.
- [x] Preserve workflow-run demo, command examples, GitHub stars, agent chips,
      and detail routes.
- [x] Run focused landing tests and type checks.

## 5. Verify And Archive

- [x] Run landing app typecheck and build checks.
- [x] Run `rtk bun run check`.
- [x] Smoke the landing page and OpenSpec detail route with HTTP content probes.
- [ ] Browser viewport smoke was attempted with Playwright, but Chromium launch
      was blocked by the local macOS sandbox
      (`bootstrap_check_in ... Permission denied`).
- [x] Record Pony Trail post-change evidence.
- [ ] Run `/opsx:archive` after human approval.
