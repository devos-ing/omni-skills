# Landing Teams and Skill Hub Design

**Status:** Detailed design approved; awaiting written-spec review
**Date:** 2026-07-14

## Summary

Reorganize the catalog half of the Omniskills landing page around two distinct
jobs:

1. feature the Startup Team as the primary coordinated-team product; and
2. provide a searchable Skill Hub for independently installable workflows and
   the individual skills those packages assemble.

The hero, startup-goal demonstration, install guide, and authoring content stay
in place. The current workflow registry becomes an editorial team feature
followed by a compact, tabbed catalog. Teams and workflows remain the
installable units. Individual skills remain source-oriented and never imply a
standalone install contract that the product does not provide.

## Problem

The landing page currently presents Startup Team beside individual role
workflows in one undifferentiated workflow registry. That hides the newly
introduced team concept and makes it difficult to answer two different user
questions:

- "Which coordinated package should I install?"
- "Which workflows and skills are available, and where are they used?"

The current rows already provide a useful package-registry pattern, but the
page needs a stronger hierarchy now that `startup-team` is a first-class team.
It also needs a truthful way to browse individual skills without pretending
that every nested dependency is independently installable.

## Goals

- Make Startup Team visibly different from a normal workflow.
- Explain the team through its coordinator, members, benefit, and exact install
  command.
- Preserve direct browsing of independently installable workflows.
- Add a deduplicated individual-skill catalog with canonical source links and
  package relationships.
- Keep search fast, local, deterministic, keyboard accessible, and useful on
  narrow screens.
- Preserve current editorial styling, existing detail routes, truthful command
  copy, and the `#workflows` deep-link contract.
- Keep agent-readable English and Traditional Chinese landing content aligned
  with the visible page.

## Non-goals

- No full hero or page-wide brand redesign.
- No remote registry, live search API, telemetry, popularity, rating, or install
  counts.
- No new standalone install command for an individual skill.
- No new individual-skill detail route.
- No manifest or CLI runtime change.
- No URL query state for the selected tab or search term.
- No ambient animation, parallax, or animated result reordering.

## Information architecture

The public landing sequence remains:

```text
Navigation
Hero
Workflow in motion
Pick an Omniskills team
Explore the Skill Hub
Install guide
Authoring content
Footer
```

The navigation and hero registry affordance become `Teams & skills` and
`Explore teams & skills`. The featured-team section retains `id="workflows"`
so existing hash links continue to work. The tabbed catalog uses
`id="skill-hub"`.

## Featured team

### Content contract

- Eyebrow: `Omniskills Teams`
- Heading: `Pick an Omniskills team`
- Lead: `Start with a coordinated team when one role is not enough. One install
  gives your agent a coordinator, specialist roles, and the playbooks that
  connect them.`
- Team name: `Startup Team`
- Description: `Move one startup goal from direction to delivery with a
  coordinator that brings in strategy, product, design, engineering, and QA
  only when the work needs them.`
- Install command: `npx omniskill@latest install startup-team`
- Primary route action: `View team`
- Source action: `View team source`
- Coordinator: `$startup-goal`
- Members: CEO, CTO, Product Manager, Web Design, Engineering Manager, Founding
  Engineer, and QA Lead.

### Composition

Startup Team renders as one full-width bordered `article`, not a registry row.
On desktop it uses an approximately 5/7 split:

- the left side contains identity, benefit, copyable install command, and
  actions;
- the right side contains a compact semantic coordinator-and-members ledger.

The team detail action continues to use the existing
`/workflows/startup-team` route, but its user-facing label is `View team`.
The source action targets `examples/teams/startup-team`.

On mobile the reading order is name, description, command, actions,
coordinator, then members. Commands wrap or scroll safely without widening the
viewport.

## Skill Hub

### Header and controls

- Eyebrow: `Skill Hub`
- Heading: `Explore the Skill Hub`
- Lead: `Browse independently installable workflows or inspect the skills they
  assemble.`
- Tabs: `Workflows` and `Skills`; `Workflows` is the default.

The desktop control group places tabs and search above the results. On mobile,
the tabs span the available width and search moves below them.

Search text persists when users switch tabs so they can compare the same term
across both catalogs. Switching tabs or filtering updates results immediately
without moving focus or replaying entrance motion.

### Workflow results

Workflow results reuse the compact editorial `WorkflowCard` presentation and
existing `/workflows/[slug]` detail routes. `startup-team` is excluded because
it appears once as the featured team.

Workflow search matches name, description, entry skill, tag, and nested skill
names or descriptions. The placeholder is:

```text
Search workflows, entry skills, or tags...
```

The empty state reads `No workflows match "{query}".` and exposes `Clear
search`.

### Skill results

Each skill appears once in a compact `SkillRow` with:

- canonical skill name;
- concise description;
- provider or source label;
- package relationship, for example `Included in Startup Team · CTO`;
- one action labelled `View skill source`.

Skill search matches name, description, provider, and package relationships.
The placeholder is:

```text
Search skills, providers, or packages...
```

The empty state reads `No skills match "{query}".` and exposes `Clear search`.

The source action is the only skill-row CTA. A skill without a truthful source
URL is omitted until its metadata is complete; the UI must not invent a link or
fall back to a package install command.

## Content and data model

Landing data remains local to `landing/lib/landing-content.ts`. Components do
not read manifests at runtime or fetch catalog data from the network.

Catalog entries gain an explicit `kind: "team" | "workflow"`. Team content also
declares its coordinator and members. Individual skill metadata uses a stable
shape equivalent to:

```ts
interface SkillHubEntry {
  id: string;
  name: string;
  description: string;
  provider: string;
  sourceUrl: string;
  usedBy: Array<{ slug: string; name: string; kind: "team" | "workflow" }>;
}
```

`id` is based on provider-qualified source identity, not display name alone.
Unqualified local role skills prefer the matching standalone public workflow
source when one exists, then the team-local source. External dependencies need
explicit canonical source metadata. `usedBy` is derived from package skill
membership so the relationship label cannot drift independently.

The Startup Team coordinator and members must continue to mirror
`examples/teams/startup-team/workflow.json` exactly. The full nested skill list
must remain source-backed and deduplicated by canonical identity.

## Component boundaries

```text
LandingPage
|- FeaturedTeamSection
|  |- TeamIdentity
|  |- TeamInstallCommand
|  `- TeamRoleLedger
`- SkillHub
   |- HubTabs
   |- HubSearch
   |- WorkflowResults -> WorkflowCard
   `- SkillResults -> SkillRow
```

`LandingPage` owns selected-tab and query state. Catalog derivation and source
resolution stay in the content module so rendering components remain small.
The existing command-copy behavior and `TerminalBlock` are reused rather than
reimplemented.

### Expected implementation surfaces

- `landing/components/landing-page.tsx`: section order, navigation labels, and
  top-level tab and search state.
- New or extracted landing components: featured-team composition, accessible
  hub tabs, and the compact skill row.
- `landing/lib/landing-content.ts`: package kinds, team roster, canonical skill
  sources, deduplication, and package relationships.
- `landing/app/globals.css`: only the responsive and interaction styles needed
  by the approved composition and motion contract.
- `landing/design.md`: durable landing hierarchy and catalog behavior.
- `docs/landing-content.md`: English agent-readable visible copy and catalog.
- `docs/landing-content.zh-Hant.md`: Traditional Chinese agent-readable mirror.
- `tests/landing-app.test.ts`: content, manifest-parity, interaction-contract,
  accessibility, and source-link regression coverage.

## Interaction and accessibility

- The tab control uses `tablist`, `tab`, and `tabpanel` semantics with
  `aria-selected` and `aria-controls`.
- Left Arrow, Right Arrow, Home, and End move and select tabs; focus remains on
  the active tab.
- Active state uses weight and a rule, not color alone.
- Search is a labelled `type="search"` control.
- The clear button has a tab-specific accessible name.
- A polite status region announces factual result counts after filtering.
- The featured team uses a labelled `article`; coordinator and members use a
  semantic list or description list.
- Source links include the team or skill name in their accessible label. Links
  opening a new tab disclose that behavior and use a safe `rel` value.
- Focus rings remain visible against the paper and white surfaces.
- Interactive targets are at least 44px on touch layouts.
- Results remain understandable without avatar color or motion.

## Motion contract

The featured composition may use the existing one-time viewport reveal:

- purpose: establish the hierarchy of the new team concept;
- frequency: once per page visit;
- motion: opacity plus at most 10px vertical translation;
- timing: 260ms with the existing strong ease-out curve.

Tabs and filtering use no positional animation because they are frequent and
keyboard-operable. Existing 2px fine-pointer arrow feedback and short press
feedback may remain. Reduced-motion mode removes translation and stagger while
retaining brief opacity or color feedback.

The implementation must not add `transition: all`, `ease-in`, `scale(0)`,
layout-property animation, ambient loops, or ungated hover motion. Every changed
animation receives a `review-animations` review with a `Before | After | Why`
table and an explicit **Approve** or **Block** verdict before release.

## Responsive behavior

- At 320px, content remains single-column with no clipped commands, labels, or
  horizontal result metadata.
- At tablet widths, team content may remain stacked until both columns have
  enough room for readable prose and the role ledger.
- At desktop widths, team identity and role membership scan as two related
  columns; workflow and skill rows remain dense horizontal lists.
- Long provider names and qualified skill sources wrap without displacing the
  row CTA.

## Testing strategy

Focused landing tests should assert:

- Startup Team renders once as a featured team and is absent from Workflow
  results.
- Its coordinator and exact seven members match the team manifest.
- Existing workflow rows still route to `/workflows/[slug]` and workflow detail
  pages retain install commands.
- Workflows and Skills tabs expose correct semantics and keyboard bindings.
- Search covers the documented fields, persists across tabs, and produces
  tab-specific empty states.
- Every skill is deduplicated, has a canonical source URL and accurate `usedBy`
  relationships, and exposes `View skill source` only.
- Copy, clear, focus, result-announcement, and reduced-motion contracts remain
  present.
- English and Traditional Chinese agent-readable landing content mirrors the
  visible catalog.

Browser smoke checks cover 320px, 768px, and a desktop viewport, including
keyboard-only tab use, visible focus, search/clear behavior, source links, and
the featured command copy action.

## Verification

Implementation is complete only after this ladder passes:

```bash
rtk bun test tests/landing-app.test.ts
rtk bun --cwd landing run typecheck
rtk bun --cwd landing run build
rtk bun run check
```

These commands match the current root and landing package scripts. Browser
smoke checks and the required animation review follow the automated checks.

## Risks and mitigations

- **Manifest/content drift:** Keep exact Startup Team roster parity under test.
- **Skill identity collisions:** Deduplicate by provider-qualified canonical
  source, not bare display name.
- **Missing external source URLs:** Omit incomplete skill rows and fail a
  content-contract test rather than creating misleading links.
- **Team/workflow terminology drift:** Use `View team` for Startup Team,
  `View workflow` for installable workflows, and `View skill source` for skill
  rows.
- **Catalog density on mobile:** Preserve metadata priority and move actions
  below identity before reducing type size.
- **Noisy accessibility announcements:** Announce result counts politely after
  filtering and do not move focus.

Rollback is a scoped landing revert: restore the current single workflow
registry, remove team and skill-hub display metadata, restore the previous nav
and hero labels, and revert the matching content mirrors and tests. Runtime,
manifest, and CLI behavior are unaffected.

## Approval gates

1. Requirements brief and visual approach: approved.
2. Startup-team role route: approved.
3. Detailed web-design direction: approved.
4. Written-spec review: user reviews this committed file before implementation
   planning begins.
5. Implementation and motion review: founding engineer plus web-design review.
6. Release verification: QA lead confirms acceptance criteria and full checks.
