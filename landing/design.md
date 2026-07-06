# GetSuperpower Landing Design

This file is the local design contract for the `landing/` app. It keeps visual,
content, and interaction changes aligned with the current OpenSpec direction
without making the root CLI package depend on landing-only decisions.

## Source Of Truth

- Active OpenSpec change:
  `openspec/changes/refactor-landing-reference-design/proposal.md`
- Active spec delta:
  `openspec/changes/refactor-landing-reference-design/specs/getsuperpower-landing/spec.md`
- Base landing spec: `openspec/specs/getsuperpower-landing/spec.md`
- Reference folder: `/Users/roy/Downloads/Create GetSuperpower Workflows/`
- Reference home page:
  `/Users/roy/Downloads/Create GetSuperpower Workflows/src/app/pages/Home.tsx`
- Reference workflow row:
  `/Users/roy/Downloads/Create GetSuperpower Workflows/src/app/components/WorkflowCard.tsx`
- Reference workflow detail:
  `/Users/roy/Downloads/Create GetSuperpower Workflows/src/app/pages/WorkflowDetail.tsx`
- Page content model: `landing/lib/landing-content.ts`
- Page shell: `landing/components/landing-page.tsx`
- Workflow entry component: `landing/components/workflow-card.tsx`
- Workflow detail route: `landing/app/workflows/[slug]/page.tsx`
- Export attribution: `landing/ATTRIBUTIONS.md`

## Product Story

The first screen should make GetSuperpower unmistakable: one command installs a
whole AI-agent workflow as a callable skill. Supporting copy should explain
workflow bundles, skill-tree installation, and root-first commands, but the
headline should stay short and product-led.

Preferred message hierarchy:

1. GetSuperpower is the product.
2. One install command gives an agent a complete workflow.
3. Workflows are shareable bundles with one entry skill.
4. Workflow bundles can be browsed like a registry, then inspected on detail
   routes.
5. Users can install, list, initialize, validate, and author bundles from the
   current root command surface.

Do not present paused Pony Trail history, revert, or prehook features as active
landing-page capabilities.

## Reference Direction

Adopt these ideas from the downloaded reference:

- A dark, technical product mood with restrained borders and compact type.
- A workflow registry section labeled "Workflow Registry".
- Workflow entries that scan like compact rows, not only marketing cards.
- Searchable workflow rows with name, tag, entry skill, sub-skill count, and a
  detail-route affordance.
- Workflow detail pages that make the install command obvious and copyable.

Do not copy these reference details:

- Decorative gradient blobs or bokeh-style ambience.
- Viewport-scaled font sizes or negative letter spacing.
- React Router, Vite entrypoints, MUI, the broad Radix component stack, or a
  charting dependency just for the leaderboard.
- Activity or install metrics before real registry telemetry exists. Do not
  show fake rank, activity, or install-count data as product evidence.

## Layout

The app is a single public marketing page with these stable sections:

1. Navigation: brand, section anchors, GitHub stars link.
2. Hero: product signal, short value prop, install command, workflow browse CTA,
   supported agent badges.
3. How it works: visual flow plus short step explanations.
4. Workflow run demo: simulated ordered sub-skill run.
5. Workflow Registry: searchable registry rows driven from
   `landing/lib/landing-content.ts`.
6. Common commands: segmented command selector plus terminal preview.
7. Authoring CTA: create command and author-guide link.
8. Footer: compact repo and docs links.

Keep sections full-width and unframed. Use cards only for repeated workflow
rows/items, command choices, terminal previews, and the final CTA panel.

## Workflow Registry

The workflow browsing section should feel like a lightweight package registry:

- Section label: `Workflow Registry`.
- Search input: full-width inside the section, with an obvious clear action
  when a query is active.
- Desktop rows: workflow identity, tag, callable entry skill, sub-skill count,
  and route affordance.
- Mobile rows: stack into a stable one-column scan layout; preserve workflow
  name, tag, entry skill, sub-skill count, and the route link.
- Metrics: hide activity, rank, and install counts until the app has real
  registry telemetry.
- Route behavior: each row links to `/workflows/[slug]`.

## Workflow Detail Pages

Each detail page should help a visitor decide whether and how to install the
workflow:

- Show the workflow name, tag, callable entry skill, ordered steps, source link,
  and install command.
- Render the install command as command-line text in a stable terminal-style
  control.
- Provide an explicit copy action for the install command.
- Copy exactly the command shown on the page.
- Keep a path back to `/#workflows`.

## Visual System

- Base surface: near-black `#080808`.
- Primary text: white, with opacity used for hierarchy.
- Primary accent: violet for brand, primary CTA, active command, and featured
  workflow emphasis.
- Secondary accents: sky, amber, and emerald for workflow variety.
- Corners: 8px radius for buttons, cards, inputs, badges, rows, and terminal
  panels.
- Icons: use `lucide-react` icons when an icon is needed.
- Typography: Vercel Geist Sans via `next/font/google`, compact, direct, and
  readable. Do not scale type with viewport width or use negative letter
  spacing.

Avoid decorative gradient blobs, bokeh, or purely atmospheric visuals. Any new
visual element should clarify the product, the workflow graph, command flow, or
workflow comparison.

## Component Rules

- Keep workflow, command, and explanatory copy in
  `landing/lib/landing-content.ts`.
- Keep components presentation-focused; they should not import root CLI runtime
  modules or read generated `.getsuperpower/` state.
- Prefer small components for stable repeated pieces such as workflow rows,
  terminal blocks, flow diagrams, and copyable command controls.
- Search, command selection, and copy feedback should remain client-side and
  deterministic.
- Preserve `landing/ATTRIBUTIONS.md` when design-export-derived content remains.

## Content Rules

Use the current root-first GetSuperpower command surface:

- `npx getsuperpower@latest install ...`
- `npx getsuperpower@latest list`
- `npx getsuperpower@latest init my-workflow`
- `npx getsuperpower@latest validate my-workflow`
- `npx getsuperpower@latest deps ...`

Do not advertise removed nested `getsuperpower` subcommands. Workflow entries
should name the callable entry skill and important sub-skills in plain
language.

## Responsive And Interaction Rules

- The first viewport must show the product signal and primary CTA on mobile and
  desktop.
- Text must wrap inside buttons, terminal panels, badges, rows, and cards
  without overlapping neighboring content.
- Workflow rows should remain scannable in a one-column mobile layout and a
  dense desktop layout.
- The workflow search input must have an obvious clear action when a query is
  active.
- Copy buttons must show clear copied feedback.
- Interactive elements should have visible hover/focus states that fit the dark
  visual system.

## Verification

For content-only changes, review the rendered copy path and scan for unfinished
markers or trailing whitespace.

For landing app changes, run from the repo root unless the command explicitly
enters `landing/`:

```bash
rtk bun test tests/landing-app.test.ts
cd landing && rtk bun run typecheck
cd landing && rtk bun run build
rtk bun run check
```

For layout or visual changes, also smoke the page in browser-sized mobile and
desktop viewports before delivery.
