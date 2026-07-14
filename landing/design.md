# Omniskills Landing Design

This file is the local design contract for the `landing/` app. It keeps visual,
content, and interaction changes aligned with the current OpenSpec direction
without making the root CLI package depend on landing-only decisions.

## Source Of Truth

- Active OpenSpec change:
  `openspec/changes/refactor-landing-reference-design/proposal.md`
- Active spec delta:
  `openspec/changes/refactor-landing-reference-design/specs/omniskill-landing/spec.md`
- Base landing spec: `openspec/specs/omniskill-landing/spec.md`
- Visual reference: `https://www.context.store`
- Page content model: `landing/lib/landing-content.ts`
- Page shell: `landing/components/landing-page.tsx`
- Featured team composition: `landing/components/featured-team-section.tsx`
- Tabbed catalog: `landing/components/skill-hub.tsx`
- Canonical skill result: `landing/components/skill-row.tsx`
- Workflow entry component: `landing/components/workflow-card.tsx`
- Workflow detail route: `landing/app/workflows/[slug]/page.tsx`
- Export attribution: `landing/ATTRIBUTIONS.md`

## Product Story

The first screen should make Omniskills unmistakable, then show the simulated
workflow, a featured coordinated team, and the Skill Hub. One command installs
a whole AI-agent team or workflow as a callable skill. Supporting copy should
explain teams, workflows, skill relationships, and root-first commands without
delaying browsing.

Preferred message hierarchy:

1. Omniskills is the product.
2. One install command gives an agent a complete workflow.
3. Teams coordinate several role workflows behind one entry skill.
4. Workflows remain independently installable; canonical skills can be
   inspected by provider and package relationship.
5. Users can install, list, initialize, validate, and author bundles from the
   current root command surface.

## Reference Direction

Adopt these ideas from the downloaded reference:

- A restrained editorial product mood: warm paper, ink text, fine rules, and
  one precise saturated accent.
- A featured `Omniskills Teams` section followed by a compact `Skill Hub`.
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
4. Omniskills Teams: one featured coordinated team with coordinator, members,
   install command, detail route, and source route.
5. Skill Hub: retained-query Workflows and Skills tabs driven from
   `landing/lib/landing-content.ts` and `landing/lib/skill-hub.ts`.
6. Common commands: segmented command selector plus terminal preview.
7. Authoring CTA: create command and author-guide link.
8. Footer: compact repo and docs links.

Keep sections full-width and unframed. Use cards only for repeated workflow
rows/items, command choices, terminal previews, and the final CTA panel.

## Omniskills Teams

The featured team section answers when to choose a coordinated team before the
visitor enters the broader catalog:

- Section label: `Omniskills Teams`.
- Heading: `Pick an Omniskills team`.
- Startup Team is the sole featured item and owns the `#workflows` anchor.
- The left pane shows its hash-seeded avatar, benefit-led description, copyable
  install command, `View team`, and `View team source` actions.
- The right pane is a semantic role ledger: `startup-goal` is the coordinator,
  followed by the seven declared members in manifest order.
- The composition stacks into one column before desktop. At 320px, commands,
  labels, roles, and actions must wrap without horizontal overflow.
- Only the outer featured composition uses the shared one-time reveal. Member
  rows do not animate independently.

## Skill Hub

`Explore the Skill Hub` separates installable Workflows from canonical Skills:

- Workflows and Skills are real ARIA tabs linked to two retained DOM tabpanels.
- Arrow Left/Right wraps focus; Home and End jump to the first and last tab.
- One query persists when switching tabs. The placeholder and clear-action
  label change to match the active catalog.
- The Workflows tab excludes Startup Team, because it is already featured. Each
  row keeps its hash-seeded avatar, tag, entry skill, sub-skill count, and
  `/workflows/[slug]` route.
- The Skills tab deduplicates by canonical source, shows provider and package
  relationships, and offers only `View skill source`. It does not invent a
  standalone install command.
- Filtering updates immediately without `Reveal`, stagger, row entrance, or
  layout animation. Both empty states remain actionable and announce result
  counts through a polite live region.
- At 320px, tabs stay side-by-side while workflow and skill rows stack into a
  stable one-column reading order.
- Until real registry telemetry exists, hide activity, rank, and install counts;
  do not substitute fake popularity evidence.

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
- Panels: white only where they clarify the featured team, commands, catalog
  rows, ordered steps, or the authoring call to action.
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
  modules or read generated `.omniskills/` state.
- Treat `featured-team-section.tsx`, `skill-hub.tsx`, and `skill-row.tsx` as
  stable presentation boundaries for the new catalog hierarchy.
- Prefer small components for stable repeated pieces such as workflow rows,
  terminal blocks, flow diagrams, and copyable command controls.
- Search, command selection, and copy feedback should remain client-side and
  deterministic.
- Preserve `landing/ATTRIBUTIONS.md` when design-export-derived content remains.

## Content Rules

Use the current root-first Omniskills command surface:

- `npx omniskill@latest install ...`
- `npx omniskill@latest list`
- `npx omniskill@latest init my-workflow`
- `npx omniskill@latest validate my-workflow`
- `npx omniskill@latest deps ...`

Do not advertise removed nested Omniskills subcommands. Workflow entries
should name the callable entry skill and important sub-skills in plain
language.

## Responsive And Interaction Rules

- The page order is masthead, workflow example, Omniskills Teams, then Skill
  Hub on mobile and desktop.
- Text must wrap inside buttons, terminal panels, badges, rows, and cards
  without overlapping neighboring content.
- Team, workflow, and skill rows should remain scannable in a one-column mobile
  layout and a dense desktop layout.
- The Skill Hub search must have an obvious catalog-specific clear action when
  a query is active, and its query must survive tab changes.
- Copy buttons must show clear copied feedback.
- Interactive elements use 120–220 ms property-specific transitions and subtle
  press feedback. Translating hover effects are gated to fine pointers.
- The workflow example is fully visible before Omniskills Teams and begins once
  when its workbench enters the viewport. Scrolling away and back must not
  restart it.
- Reduced motion removes transform and smooth-scroll movement while retaining
  short 150–200 ms opacity and color transitions for legible state changes.

## Motion System

- The masthead uses a one-time four-beat reveal for the product signal,
  headline, explanation, and install controls. It must remain readable before
  hydration and must not replay during normal navigation.
- The featured team reveals once as a single composition. Skill Hub filtering
  updates immediately and must not replay or add entrance motion to result rows.
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
