# GetSuperpower Landing Design

This file is the local design landing page for the `landing/` app. It keeps
future visual, content, and interaction changes aligned with the approved
OpenSpec direction without making the root CLI package depend on landing-only
decisions.

## Source Of Truth

- OpenSpec scope: `openspec/changes/create-next-landing-folder/proposal.md`
- OpenSpec behavior contract:
  `openspec/changes/create-next-landing-folder/specs/getsuperpower-landing/spec.md`
- Page content model: `landing/lib/landing-content.ts`
- Page shell: `landing/components/landing-page.tsx`
- Global style baseline: `landing/app/globals.css`
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
4. Users can install, list, initialize, validate, and author bundles from the
   current root command surface.

Do not present paused Pony Trail history, revert, or prehook features as active
landing-page capabilities.

## Layout

The app is a single public marketing page with these stable sections:

1. Navigation: brand, section anchors, GitHub link.
2. Hero: product signal, short value prop, install command, workflow browse CTA,
   supported agent badges.
3. How it works: visual flow plus short step explanations.
4. Workflow bundles: searchable cards driven from `landing/lib/landing-content.ts`.
5. Common commands: segmented command selector plus terminal preview.
6. Authoring CTA: create command and author-guide link.
7. Footer: compact repo and docs links.

Keep sections full-width and unframed. Use cards only for repeated workflow
items, command choices, terminal previews, and the final CTA panel.

## Visual System

- Base surface: near-black `#080808`.
- Primary text: white, with opacity used for hierarchy.
- Primary accent: violet for brand, primary CTA, active command, and featured
  workflow emphasis.
- Secondary accents: sky, amber, and emerald for workflow variety.
- Corners: 8px radius for buttons, cards, inputs, badges, and terminal panels.
- Icons: use `lucide-react` icons when an icon is needed.
- Typography: compact, direct, and readable. Do not scale type with viewport
  width or use negative letter spacing.

Avoid decorative gradient blobs, bokeh, or purely atmospheric visuals. Any new
visual element should clarify the product, the workflow graph, or the command
flow.

## Component Rules

- Keep workflow, command, and explanatory copy in `landing/lib/landing-content.ts`.
- Keep components presentation-focused; they should not import root CLI runtime
  modules or read generated `.getsuperpower/` state.
- Prefer small components for stable repeated pieces such as workflow cards,
  terminal blocks, and flow diagrams.
- Search and command selection should remain client-side and deterministic.
- Preserve `landing/ATTRIBUTIONS.md` when design-export-derived content remains.

## Content Rules

Use the current root-first command surface:

- `npx getsuperpower@latest install ...`
- `npx getsuperpower@latest list`
- `npx getsuperpower@latest init my-workflow`
- `npx getsuperpower@latest validate my-workflow`
- `npx getsuperpower@latest deps ...`

Do not advertise removed nested `getsuperpower` subcommands. Workflow cards
should name the callable entry skill and the important sub-skills in plain
language.

## Responsive And Interaction Rules

- The first viewport must show the product signal and primary CTA on mobile and
  desktop.
- Text must wrap inside buttons, terminal panels, badges, and cards without
  overlapping neighboring content.
- Workflow cards should remain scannable in a one-column mobile layout and a
  two-column desktop layout.
- The workflow search input must have an obvious clear action when a query is
  active.
- Interactive elements should have visible hover/focus states that fit the dark
  visual system.

## Verification

For content-only changes, review the rendered copy path and scan for unfinished
markers or trailing whitespace.

For landing app changes, run from the repo root unless the command explicitly
enters `landing/`:

```bash
rtk bun run check
cd landing && bun run typecheck
cd landing && bun run build
```

For layout or visual changes, also smoke the page in a browser-sized mobile and
desktop viewport before delivery.
