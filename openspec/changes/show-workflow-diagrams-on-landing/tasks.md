# Tasks

## 1. Proposal Revision

- [x] Revise the active OpenSpec proposal from in-page workflow selection to
      dedicated workflow detail routes.
- [x] Update the spec delta and task checklist for route-based workflow detail
      behavior.
- [x] Review `proposal.md` scope with the human owner.
- [x] Confirm the v1 URL shape (`/workflows/[slug]`).
- [x] Confirm whether workflow details should live only on the route or also
      keep a compact landing preview.
- [x] Confirm the "Back to workflows" link target (`/#workflows`).

## 2. Brainstorm Design

- [x] Explore 2-3 route/detail layout approaches with trade-offs.
- [x] Confirm the recommended route-based design with the human owner.
- [x] Save the approved design to `docs/superpowers/specs/`.
- [x] Re-review the written design for unfinished markers, contradictions, and
      scope creep.

## 3. Plan Implementation

- [x] Write the implementation plan in `docs/superpowers/plans/`.
- [x] Include TDD slices for route metadata, card link navigation, detail page
      rendering, unknown slug handling, GitHub source links, search behavior,
      and landing verification.

## 4. Implement With TDD

- [ ] Confirm public test seams with the human owner before writing tests.
- [ ] Add failing landing source-contract tests that workflow cards link to
      `/workflows/[slug]`.
- [ ] Add failing tests that a route page exists for workflow details and uses
      local static workflow data.
- [ ] Add failing tests that unknown slugs use `notFound()`.
- [ ] Extend workflow content with any detail-page fields needed by the route.
- [ ] Update `landing/components/workflow-card.tsx` to render a route link.
- [ ] Add `landing/app/workflows/[slug]/page.tsx`.
- [ ] Adapt `WorkflowDetail` for route-level rendering or create a focused
      route detail component.
- [ ] Remove landing-page selected-workflow state if route-only detail is
      approved.
- [ ] Run focused landing tests and type checks.

## 5. Verify And Archive

- [ ] Run landing app typecheck and build checks.
- [ ] Run `rtk bun run check`.
- [ ] Smoke the landing page and detail pages in desktop and mobile viewports.
- [ ] Record Pony Trail post-change evidence.
- [ ] Run `/opsx:archive` after human approval.
