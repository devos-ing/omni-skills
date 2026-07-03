# Proposal: Add Watch The Workflow Run Section

## Summary

Add a "Watch the workflow run" section to the GetSuperpower landing page.

The section should adapt the downloaded "Create GetSuperpower Workflows"
reference app's simulator idea for the current Next landing app: a visitor sees
an agent invoke `$openspec-delivery`, then watches the required sub-skills run in
order through a compact pipeline and terminal-style output.

## Motivation

The landing page explains that a GetSuperpower installs a skill tree and exposes
one callable entry skill, but that idea is still abstract. The downloaded
reference app includes a simulator section that makes the core product promise
concrete: one prompt triggers proposal, design, planning, TDD, verification, and
archive work.

Adding this section helps visitors understand the product before they browse
individual workflow cards or copy install commands.

## Scope

In scope:

- Add a landing section titled "Watch the workflow run".
- Place the section after "How it works" and before workflow cards.
- Show a simulated `$openspec-delivery` invocation.
- Show ordered phases for proposal, design, plan, TDD build, verification, and
  archive.
- Use static local content and client-side UI only.
- Keep the existing landing visual language: dark surface, restrained borders,
  8px-radius controls/cards, and dense technical copy.
- Add focused landing source-contract tests for the new section/component.
- Preserve current workflow-card, command, logo, and install behavior.

Out of scope:

- Running a real agent workflow in the browser.
- Fetching live workflow state from the CLI, GitHub, or `.getsuperpower/`.
- Adding video uploads, external embeds, server routes, or analytics.
- Changing the GetSuperpower CLI or workflow manifest format.
- Replacing the existing workflow-card detail view.

## Proposed Design Direction

Use a small, focused landing component rather than putting simulator state
directly into `LandingPage`.

- Add local typed content for the workflow-run phases in
  `landing/lib/landing-content.ts`.
- Add a `WorkflowRunDemo` client component under `landing/components/`.
- Render a static or lightly animated pipeline of the OpenSpec Delivery phases.
- Render terminal-style lines that show the currently visible workflow output.
- Include a replay/reset control if animation is used.
- Avoid random timing so rendering and tests stay deterministic.

## Acceptance Criteria

- The landing page includes a section with the visible heading "Watch the
  workflow run".
- The section appears between "How it works" and "Workflow bundles".
- The section shows the `$openspec-delivery` entry skill invocation.
- The section shows these phases in order: proposal, design, plan, TDD build,
  verification, archive.
- The section makes clear that the workflow is a simulated run, not a live
  browser execution of an agent.
- The component remains responsive on mobile and desktop.
- Existing landing search, workflow detail, command examples, agent badges, and
  footer links continue to render.
- Focused source-contract tests cover the new content/component wiring.
- `rtk bun run check` passes before delivery.
- Landing app typecheck/build or equivalent smoke checks pass before delivery.

## Decisions

- The user selected the full interactive simulator direction.
- The first version auto-plays deterministically and includes `Pause`,
  `Resume`, `Replay`, and phase-inspection controls.
- The section labels the experience as "Simulated run" in the eyebrow and
  explains in the body that the browser demo is local and simulated.
