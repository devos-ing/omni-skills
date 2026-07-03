# Proposal: Show Workflow Diagrams On Landing Cards

## Summary

Change the landing page workflow-card action from passive "View workflow" text
into an interactive in-page workflow detail view.

When a visitor chooses "View workflow" on a workflow card, the page should show
that workflow's diagram and key source details without immediately leaving the
landing page. The detail view should still include a GitHub source link for
visitors who want to inspect the actual workflow bundle.

## Motivation

The current landing page has workflow cards that describe each GetSuperpower,
but the "View workflow" affordance is not actionable. Sending visitors straight
to GitHub would be simple, but it makes the product explanation depend on
source-code browsing.

The selected direction from the visual companion is option B: keep visitors on
the landing page first and show a clear workflow diagram. This better explains
how a GetSuperpower works while preserving a path to the source folder for
technical inspection.

## Scope

In scope:

- Make each workflow card's "View workflow" action interactive.
- Add workflow detail metadata to the landing content model.
- Show an in-page detail view for the selected workflow.
- Render the selected workflow as an ordered diagram of entry skill and
  sub-skill steps.
- Include a GitHub source link inside the workflow detail view.
- Keep search, command examples, agent badges, and existing landing content
  intact.
- Add focused tests for the landing source contract.

Out of scope:

- Adding routes, server-side APIs, registry browsing, or hosted workflow data.
- Fetching workflow manifests dynamically from GitHub.
- Changing GetSuperpower CLI behavior or workflow bundle validation.
- Replacing the existing global "How it works" section.
- Rewriting the landing app visual direction.
- Publishing or deploying the landing app.

## Proposed Design Direction

Use the existing data-driven landing structure:

- Extend `WorkflowCardContent` with a stable slug, GitHub source URL, and
  ordered diagram steps.
- Render the card action as a button or anchor-like control that selects the
  workflow in `LandingPage`.
- Add a focused workflow detail component near the workflow-card grid, reusing
  the dark technical visual style and 8px-radius cards already used by the
  landing app.
- Make GitHub the secondary action inside the detail view, not the default card
  click target.
- If the selected workflow is filtered out by search, clear or replace the
  selected detail with the first visible matching workflow.

The v1 should stay static and local to `landing/`; no runtime dependency on the
root CLI or generated `.getsuperpower/` records is needed.

## Acceptance Criteria

- Every rendered workflow card exposes an actionable "View workflow" control.
- Activating "View workflow" shows an in-page detail view for that workflow.
- The detail view includes the workflow name, callable entry skill, ordered
  workflow steps, and a GitHub source link.
- The GitHub source link points to the matching workflow folder under
  `https://github.com/0xroylee/getsuperpower`.
- The page does not immediately redirect visitors away from the landing page
  when they choose "View workflow".
- The workflow search remains usable and does not leave a hidden or stale
  selected workflow detail on screen.
- Existing root CLI behavior and package scripts remain unchanged.
- `rtk bun run check` passes before delivery.
- Landing app typecheck/build checks pass before delivery.

## Open Questions For Review

- Should the selected workflow detail appear directly below the workflow grid,
  or as a right-side detail panel on desktop that stacks below cards on mobile?
- Should the GitHub source link open in the same tab or a new tab?
- Should v1 auto-select the featured OpenSpec Delivery workflow when the
  workflow section first loads, or wait until the visitor clicks a card?
