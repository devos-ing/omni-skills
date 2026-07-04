# Proposal: Route Workflow Cards To Detail Pages

## Summary

Change the landing page workflow-card action from passive "View workflow" text
into navigation to a dedicated workflow detail page.

When a visitor chooses "View workflow" on a workflow card, the browser should
navigate to `/workflows/[slug]`. The detail page should show that workflow's
diagram, callable entry skill, ordered sub-skills, install command, and source
link.

## Motivation

The current landing page has workflow cards that describe each GetSuperpower,
but the "View workflow" affordance does not behave like a page-level detail
action. The previous in-page panel direction makes the card action easy to miss
and keeps workflow details secondary to the landing section layout.

Dedicated detail routes make each workflow shareable, bookmarkable, and easier
to inspect without forcing visitors into GitHub source browsing. GitHub should
remain a secondary source action from the detail page.

## Scope

In scope:

- Make each workflow card's "View workflow" action navigate to a workflow
  detail route.
- Add workflow detail metadata to the landing content model.
- Add static Next routes under `landing/app/workflows/[slug]/`.
- Render the selected workflow as a dedicated detail page with ordered workflow
  steps.
- Include a GitHub source link inside the workflow detail page.
- Include a route back to the workflow section on the landing page.
- Keep search, command examples, agent badges, and existing landing content
  intact.
- Add focused tests for the landing source contract.

Out of scope:

- Server-side APIs, registry browsing, or hosted workflow data.
- Fetching workflow manifests dynamically from GitHub.
- Changing GetSuperpower CLI behavior or workflow bundle validation.
- Replacing the existing global "How it works" section.
- Rewriting the landing app visual direction.
- Publishing or deploying the landing app.

## Proposed Design Direction

Use the existing data-driven landing structure:

- Keep workflow data in `landing/lib/landing-content.ts` with stable slugs,
  source URLs, install commands, and ordered diagram steps.
- Render each workflow card action as a Next `Link` to
  `/workflows/${workflow.slug}`.
- Add `landing/app/workflows/[slug]/page.tsx` for statically rendered workflow
  detail pages.
- Reuse or adapt the existing `WorkflowDetail` presentation as a route-level
  component instead of a side panel.
- Use `generateStaticParams()` so every local workflow slug has a static route.
- Use `notFound()` for an unknown workflow slug.
- Keep GitHub as a secondary action inside the detail page, not the default card
  click target.

The v1 should stay static and local to `landing/`; no runtime dependency on the
root CLI or generated `.getsuperpower/` records is needed.

## Acceptance Criteria

- Every rendered workflow card exposes an actionable "View workflow" control.
- Activating "View workflow" navigates to `/workflows/[slug]` for that workflow.
- The detail view includes the workflow name, callable entry skill, ordered
  workflow steps, install command, and a GitHub source link.
- The GitHub source link points to the matching workflow folder under
  `https://github.com/0xroylee/getsuperpower`.
- Unknown workflow slugs render the Next not-found path instead of an empty
  detail page.
- The workflow search remains usable and filtered cards continue to link to the
  correct detail routes.
- Existing root CLI behavior and package scripts remain unchanged.
- `rtk bun run check` passes before delivery.
- Landing app typecheck/build checks pass before delivery.

## Open Questions For Review

- Is `/workflows/[slug]` the desired URL shape for v1?
- Should the landing page keep any compact preview state after cards become
  links, or should the detail live only on the dedicated route?
- Should the detail page add a "Back to workflows" link to `/#workflows`?
