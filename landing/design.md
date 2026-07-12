# Omniskills Landing Design

This file is the local design contract for the `landing/` app. It keeps visual,
content, and interaction changes aligned with the current OpenSpec direction
without making the root CLI package depend on landing-only decisions.

## Source Of Truth

- Active OpenSpec change:
  `openspec/changes/refactor-landing-reference-design/proposal.md`
- Active spec delta:
  `openspec/changes/refactor-landing-reference-design/specs/omniskills-landing/spec.md`
- Base landing spec: `openspec/specs/omniskills-landing/spec.md`
- Visual reference: `https://www.context.store`
- Page content model: `landing/lib/landing-content.ts`
- Page shell: `landing/components/landing-page.tsx`
- Workflow entry component: `landing/components/workflow-card.tsx`
- Workflow detail route: `landing/app/workflows/[slug]/page.tsx`
- Export attribution: `landing/ATTRIBUTIONS.md`

## Product Story

The first screen should make Omniskills unmistakable, then move directly into
the workflow registry. One command installs a whole AI-agent workflow as a
callable skill. Supporting copy should explain workflow bundles, skill-tree
installation, and root-first commands without delaying browsing.

Preferred message hierarchy:

1. Omniskills is the product.
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

- A restrained editorial product mood: warm paper, ink text, fine rules, and
  one precise saturated accent.
- A workflow registry section labeled "Workflow Registry".
- Workflow entries that scan like compact rows, not only marketing cards.
- Searchable workflow rows with name, tag, entry skill, sub-skill count, and a
  detail-route affordance.
- Deterministic workflow avatars that give each row a visual identity without
  implying user activity or popularity.
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
2. Masthead: a left-aligned product signal, short value proposition, and one
   install command without badge or chip rows.
3. Workflow example: a visible simulated workflow run that starts once when it
   enters the viewport.
4. Workflow Registry: searchable registry rows driven from
   `landing/lib/landing-content.ts`.
5. Common commands: segmented command selector plus terminal preview.
6. Authoring CTA: create command and author-guide link.
7. Footer: compact repo and docs links.

Keep sections full-width and unframed. Use cards only for repeated workflow
rows/items, command choices, terminal previews, and the final CTA panel.

## Workflow Registry

The workflow browsing section should feel like a lightweight package registry:

- Section label: `Workflow Registry`.
- Content set: lead with the current startup role catalog (`startup-team`,
  `ceo`, `cto`, `product-manager`, `engineering-manager`,
  `founding-engineer`, and `qa-lead`).
- Search input: full-width inside the section, with an obvious clear action
  when a query is active.
- Desktop rows: hash-seeded avatar, workflow identity, tag, callable entry
  skill, sub-skill count, and route affordance.
- Mobile rows: stack into a stable one-column scan layout; preserve workflow
  avatar, name, tag, entry skill, sub-skill count, and the route link.
- Avatars: render `boring-avatars` from the workflow's checked
  `workflow.lock.json` skill hash so visual identity follows the skill tree.
- Metrics: hide activity, rank, and install counts until the app has real
  registry telemetry.
- Route behavior: each row links to `/workflows/[slug]`.

## Workflow Detail Pages

Each detail page should help a visitor decide whether and how to install the
workflow:

- Show the workflow name, tag, callable entry skill, ordered steps, source link,
  and install command.
- Reuse the same hash-seeded workflow avatar from the registry row.
- Render the install command as command-line text in a stable terminal-style
  control.
- Provide an explicit copy action for the install command.
- Copy exactly the command shown on the page.
- Keep a path back to `/#workflows`.

## Visual System

- Base surface: warm off-white `#f6f4ef`.
- Primary text: ink `#191817`; body text is `#4f4b46`; muted metadata is
  `#716e68`; faint decorative text is `#9a958d`. Do not create text hierarchy
  with low-opacity ink.
- Rules: solid `#dedbd3`, including card, input, and terminal borders.
- Primary accent: red-orange `#e64b2e` for the brand mark, primary CTA,
  selection, and completion states.
- Panels: white only where they clarify commands, registry rows, ordered steps,
  or the authoring call to action.
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

Use the current root-first Omniskills command surface:

- `npx omniskills@latest install ...`
- `npx omniskills@latest list`
- `npx omniskills@latest init my-workflow`
- `npx omniskills@latest validate my-workflow`
- `npx omniskills@latest deps ...`

Do not advertise removed nested Omniskills subcommands. Workflow entries
should name the callable entry skill and important sub-skills in plain
language.

## Responsive And Interaction Rules

- The first viewport must show the product signal and the beginning of the
  workflow registry on mobile and desktop.
- Text must wrap inside buttons, terminal panels, badges, rows, and cards
  without overlapping neighboring content.
- Workflow rows should remain scannable in a one-column mobile layout and a
  dense desktop layout.
- The workflow search input must have an obvious clear action when a query is
  active.
- Copy buttons must show clear copied feedback.
- Interactive elements use 120–220 ms property-specific transitions and subtle
  press feedback. Translating hover effects are gated to fine pointers.
- The workflow example is fully visible before the registry and begins once when
  its workbench enters the viewport. Scrolling away and back must not restart it.
- Reduced motion removes transform and smooth-scroll movement while retaining
  short 150–200 ms opacity and color transitions for legible state changes.

## Motion System

- The masthead uses a one-time four-beat reveal for the product signal,
  headline, explanation, and install controls. It must remain readable before
  hydration and must not replay during normal navigation.
- Registry rows reveal once with a 50 ms stagger capped at six indices so the
  cascade resolves quickly. Search filtering must update immediately without
  replaying the entrance.
- Workflow rows, arrows, and avatars use subtle fine-pointer feedback. Touch and
  keyboard interaction must not depend on hover motion.
- The workflow workbench is visible by default and its sequence starts once on
  viewport entry. Active roles use a finite status pulse, connectors communicate
  progress through transform, and completion settles into a static state.
- Replay explicitly resets and restarts the sequence. Reduced motion shows the
  completed static workflow without scheduling phase timers.
- Entrances animate only opacity and transform with the shared strong ease-out
  curve. Do not add ambient loops, parallax, layout-property animation,
  `transition: all`, `ease-in`, or `scale(0)`.
- Under reduced motion, remove translation, pulse, stagger, and smooth scrolling
  while preserving short opacity and color feedback.

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
