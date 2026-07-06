# Proposal: Refactor Landing Page From Reference Design

## Summary

Update the GetSuperpower landing page to use the current downloaded reference
folder at `/Users/roy/Downloads/Create GetSuperpower Workflows/` as the design
source for the workflow browsing experience.

The refactor should keep the existing isolated Next.js landing app and the
route-backed workflow detail pages, but reshape the workflow list from a simple
card grid into a compact workflow registry surface: searchable rows and clear
route links without placeholder activity or install metrics.

Also update `landing/design.md` so future landing work has a local design
contract based on the reference rather than only the original app-port notes.

## Motivation

The current landing page already explains GetSuperpower, shows the simulated
workflow run, and links workflow cards to detail pages. The downloaded
reference pushes the workflow area further toward a real registry experience:
visitors can compare workflows quickly and understand that GetSuperpower bundles
are installable assets rather than static marketing cards.

That comparison surface is now the clearest gap between the reference and the
repo-local landing page.

## Scope

In scope:

- Update `landing/design.md` from the downloaded reference folder.
- Preserve the existing Next.js 16 App Router structure under `landing/`.
- Keep GitHub stars, agent logo chips, workflow-run simulation, route-backed
  detail pages, command examples, and attribution.
- Replace or adapt the workflow-card grid with a reference-inspired workflow
  registry/table surface.
- Hide activity, rank, and install metrics until real registry telemetry exists.
- Keep workflow search and clear-search behavior.
- Keep every visible workflow row/card linked to `/workflows/[slug]`.
- Show each workflow detail page's install command in a copyable command-line
  control.
- Add or update focused Bun source-contract tests for the new browsing surface.
- Run landing and repo verification before delivery.

Out of scope:

- Importing the reference app's broad Vite, MUI, Radix, Recharts, or
  React Router dependency stack.
- Fetching live workflow registry metrics.
- Showing fake local activity, rank, or install-count data as product evidence.
- Changing GetSuperpower CLI behavior.
- Replacing workflow detail routes with React Router.
- Advertising paused Pony Trail history, revert, or prehook features as active
  product capabilities.
- Publishing or deploying the landing app.

## Reference Findings

The downloaded reference is a Vite React export with these useful design ideas:

- `src/app/pages/Home.tsx` presents a dark technical landing page with a
  workflow leaderboard after the run simulator.
- `src/app/components/WorkflowCard.tsx` renders each workflow as a compact row;
  the repo keeps that row shape while omitting placeholder metric data.
- `src/app/components/Simulator.tsx` matches the already-ported
  workflow-run-demo concept.
- `src/app/pages/WorkflowDetail.tsx` uses a left sub-skill rail and detailed
  workflow explanation, while the repo already has equivalent route-backed
  pages.

The reference also includes decorative gradient blobs and viewport-scaled hero
type. The repo design rules disallow those patterns, so the implementation
should translate the registry structure and interaction model without copying
those visual details verbatim.

## Proposed Design Direction

Keep the page hierarchy:

1. Header with brand, anchors, and GitHub stars.
2. Hero with product signal, command, CTA, and supported agents.
3. How it works.
4. Simulated workflow run.
5. Workflow registry.
6. Common commands.
7. Authoring CTA and footer.

Change the workflow browsing section:

- Rename the section to "Workflow Registry" for a neutral registry framing.
- Keep a full-width search input above the list.
- Render workflow entries as dense rows on desktop with workflow identity,
  callable entry skill, sub-skill count, and detail affordance.
- On mobile, collapse rows into a single-column scan layout while preserving
  workflow name, tag, entry skill, sub-skill count, and route link.
- Do not show activity, rank, or install metrics until real telemetry exists.
- Keep `/workflows/[slug]` as the workflow detail URL.
- Keep each workflow detail page's install command visible and allow visitors
  to copy it from the page.

Update `landing/design.md` to document:

- the downloaded reference path and relevant source files;
- which reference ideas are adopted;
- which reference patterns are intentionally not copied;
- the local component and data seams for the refactor;
- responsive and verification expectations.

## Acceptance Criteria

- `landing/design.md` names the downloaded reference folder and the adopted
  workflow-registry design direction.
- The landing workflow browsing section presents workflows as a compact registry
  list rather than a plain two-column card grid.
- The browsing section includes a search input and clear action.
- Each visible workflow entry includes the workflow name, tag, callable entry
  skill, sub-skill count, and a route link to `/workflows/[slug]`.
- The browsing section does not show placeholder activity, rank, or install
  metrics while real telemetry is unavailable.
- Each workflow detail page shows the install command and provides an explicit
  copy action.
- The refactor does not add new runtime dependencies unless explicitly approved
  after the repo's dependency recency check.
- GitHub stars, workflow-run demo, command examples, agent chips, and workflow
  detail routes still exist.
- Focused source-contract tests cover the design-doc update and the new
  workflow browsing surface.
- Landing typecheck/build and the root `rtk bun run check` gate pass before
  delivery.

## Approved Review Decisions

- Public section label: "Workflow Registry".
- Activity and install counts: hide for now because the product does not have
  real registry telemetry yet.
- Detail page install command: show the command line and provide a copy action.
