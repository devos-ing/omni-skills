# Landing Src Style Refactor Design

## Purpose

Refactor the GetSuperpower landing experience so the homepage and workflow detail
routes use the visual style from the downloaded reference app at
`/Users/roy/Downloads/Create GetSuperpower Workflows/src/`.

The implementation should port the reference design language into the existing
Next landing app. It should not transplant the reference app wholesale.

## Approved Direction

Use visual parity with the reference `src` as the design target while preserving
the repo-owned Next app structure, real workflow content, GitHub stars fetch, and
tests.

The refactor covers both:

- `landing/app/page.tsx`
- `landing/app/workflows/[slug]/page.tsx`

The refactor should avoid new dependencies for the activity sparkline visuals.
The reference uses `recharts`, but this app should use a small local SVG
sparkline component instead.

## Architecture

The existing Next structure remains authoritative:

- `landing/app/page.tsx` keeps the server-side GitHub stars fetch and passes the
  formatted label into the client landing page.
- `landing/app/workflows/[slug]/page.tsx` keeps the static workflow detail route
  and `notFound()` behavior.
- `landing/lib/landing-content.ts` remains the single source of truth for real
  workflow content.
- Client UI components absorb the reference styling and interaction patterns.

The main architectural change is a presentation layer around existing content:

- deterministic leaderboard metadata,
- local SVG sparklines,
- richer workflow detail fields where the reference layout needs them,
- shared styling conventions that mirror the downloaded `src`.

Do not introduce React Router, Recharts, fake install counts, or a second content
source.

## Components

The homepage should mirror the style and structure of the reference
`src/app/pages/Home.tsx`:

- ambient dark background with subtle violet, sky, and emerald glows,
- compact nav with gradient GetSuperpower mark and GitHub link,
- hero badge, large gradient headline, command chip, and browse CTA,
- agent badges,
- how-it-works section with two-column flow diagram plus explanatory rows,
- animated workflow simulator adapted from
  `src/app/components/Simulator.tsx`,
- workflow leaderboard with search, tabs, rank, workflow name, source label,
  tag, activity sparkline, and repo-owned metric,
- install/common commands section,
- create-your-own CTA and footer styled like the reference.

The workflow detail route should mirror the reference
`src/app/pages/WorkflowDetail.tsx`:

- sticky top nav and breadcrumb,
- desktop sidebar with workflow identity, sub-skill navigation, and copy-install
  action,
- hero/invoke block,
- install command row,
- skill-step cards,
- workflow JSON block,
- source block,
- related workflows,
- mobile single-column layout without relying on sticky sidebar behavior.

Expected shared components:

- `WorkflowCard`
- `TerminalBlock`
- `FlowDiagram`
- `WorkflowRunDemo` or `Simulator`
- `Sparkline`
- `WorkflowDetail`

Component boundaries should stay small. Styling can be utility-class-heavy to
match the existing landing app and the downloaded reference, but shared visual
widgets should be extracted when reused on both homepage and detail routes.

## Data Flow

`landing/lib/landing-content.ts` remains the source for workflow data. Expand its
workflow type only where the reference detail page needs richer fields:

- long description,
- usage example,
- source label or source URL,
- agent list,
- accent background and border classes,
- optional skill detail,
- optional skill output.

Homepage filtering derives from the same `workflows` array. The leaderboard adds
deterministic presentation metadata locally:

- rank from array order,
- skill count,
- fixed activity arrays keyed by workflow slug for sparkline shape.

Do not display fake install counts. If a table column needs a numeric metric,
use a repo-owned deterministic metric such as skill count.

The detail route uses the same workflow objects through `getWorkflow(slug)`, so
cards, search results, static params, related workflows, and detail pages stay
aligned.

## States And Error Handling

The GitHub stars fetch keeps its existing fail-closed fallback.

Client-side copy actions show a short copied state, then return to the normal
label. If clipboard access is unavailable, the UI should avoid getting stuck in
the copied state.

Search uses the reference empty state:

- search icon,
- no-match text,
- clear-search action.

Unknown workflow detail routes continue to use `notFound()`.

Responsive behavior should preserve readability:

- the leaderboard becomes horizontally scrollable or simplified on narrow
  screens,
- labels and sparklines must not collide,
- detail sidebar appears on desktop,
- mobile detail content appears in document order with usable controls.

## Testing And Verification

Update source-contract tests for expanded `landing/lib/landing-content.ts`
fields.

Add focused tests for deterministic leaderboard metadata and workflow lookup or
static params if existing tests do not already cover those seams.

Verification commands:

```bash
rtk bun test tests/landing-app.test.ts
rtk bun run check
```

For package-local landing verification, run from `landing/`:

```bash
rtk bun run check
```

For visual smoke verification, run the landing app locally and inspect:

- homepage at desktop width,
- homepage at mobile width,
- at least one workflow detail route at desktop width,
- at least one workflow detail route at mobile width.

The smoke pass should confirm that the reference style is visible, route
navigation works, text does not overlap, sparklines render, and copy/search
states are usable.

## Non-Goals

- Do not rewrite the landing app as a React Router app.
- Do not add Recharts just for sparklines.
- Do not show fake install counts or fabricated popularity claims.
- Do not change CLI/runtime behavior.
- Do not expose paused Pony Trail history, revert, or prehook features as active
  landing-page product claims.
- Do not change unrelated dirty files in the current worktree.
