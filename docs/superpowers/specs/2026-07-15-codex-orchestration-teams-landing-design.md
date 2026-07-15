# Codex Orchestration Teams and Landing Design

**Status:** Approved design; awaiting written-spec review

**Date:** 2026-07-15

## Summary

Reposition the Omniskills landing page around **Orchestration for Codex** and
show that promise through one control-tower animation: a coordinator clarifies
one goal, dispatches the right specialist sub-agents, collects their work, and
returns one verified result.

Replace the current three startup-only demo cases with three deterministic
examples backed by real installable teams:

1. `startup-team` builds and verifies a landing page.
2. `finance-team` researches a public company or stock.
3. `market-team` assesses the market regime.

The landing demo remains hardcoded and clearly labeled. It does not launch
agents, fetch market data, require credentials, or imply that its market output
is current. The Finance Team and Market Team are real first-class team bundles
whose specialist members can use public sources through whatever browsing tools
their host agent provides.

## Customer and problem

The primary visitor is a developer who knows Codex but has not yet used agent
orchestration. The current landing page explains workflows and shows a detailed
startup simulation, but its top-level promise is broad and the demo does not
make coordinator control visually immediate.

The visitor should understand within the first screen and first demo cycle:

- Omniskills installs coordinated teams for Codex.
- One coordinator owns the goal, approval gates, role routing, synthesis, and
  verification.
- Specialist sub-agents can work in parallel without the user manually
  juggling prompts or skills.
- Every showcased case maps to a real team the visitor can install.

## Goals

- Make `Orchestration for Codex` the primary landing-page position.
- Explain orchestration without assuming the visitor knows agent-framework
  jargon.
- Use a restrained control-tower animation to show fan-out, fan-in, and a final
  verification gate.
- Replace the existing startup-only cases with landing, finance, and market
  examples.
- Add real `finance-team` and `market-team` bundles whose member structure
  matches the demo.
- Make every case end in a visible, copyable install command.
- Preserve support for Claude, Cursor, opencode, and GitHub Copilot as secondary
  compatibility.
- Keep durable landing copy centralized and mirrored in English and Traditional
  Chinese documentation.
- Preserve the current dirty worktree and stage only files created or changed
  for this approved scope.

## Non-goals

- No live agent execution from the landing page.
- No live, delayed, or cached market-data feed on the landing page.
- No required financial-data API, bundled API key, provider SDK, or scraping
  adapter.
- No personalized buy, sell, entry, or position-sizing recommendation.
- No claim that the hardcoded finance or market example is current.
- No unrelated redesign of the Skill Hub or workflow detail routes.
- No new orchestration engine; the teams use the existing manifest, install,
  dispatch, and receipt contracts.
- No compatibility rename of `startup-team` or its `$startup-goal` coordinator.

## Public names and commands

| Team | Package | Coordinator | Install command |
| --- | --- | --- | --- |
| Startup Team | `startup-team` | `$startup-goal` | `npx omniskill@latest install startup-team` |
| Finance Team | `finance-team` | `$finance-research` | `npx omniskill@latest install finance-team` |
| Market Team | `market-team` | `$market-research` | `npx omniskill@latest install market-team` |

The package and coordinator are separate public contracts. Team cards and case
controls use the package name; prompts use the coordinator name.

## Landing information architecture

### 1. Hero

- Eyebrow: `Orchestration for Codex`.
- Headline: `One goal. A team of agents. One verified result.`
- Supporting copy: install a coordinated team of specialist skills; one
  coordinator clarifies the goal, dispatches the right sub-agents, and combines
  verified output.
- Primary action: `Watch a team run`, scrolling to the orchestration demo.
- Secondary action: copy
  `npx omniskill@latest install startup-team`.
- The supported-agent row remains, but Codex is the position and the other
  agents are compatibility.

### 2. How it works

Keep a compact three-step explanation:

1. Install one team.
2. Call its coordinator with a goal.
3. Approve the route, let specialists work, and receive one verified result.

`FlowDiagram` becomes a compact static version of the same model: goal,
coordinator, specialist team, verified result. It must not compete with the
full interactive demo.

### 3. Orchestration demo

`WorkflowRunDemo` remains the single detailed simulation and is redesigned as
the approved control-tower fan-out/fan-in workbench. The current three
startup-only cases are removed.

The demo contains:

- three keyboard-accessible case tabs;
- one goal/prompt region;
- a persistent coordinator node;
- parallel specialist lanes;
- visible approval, collection, synthesis, and verification states;
- a final result summary;
- the matching copyable install command;
- `Replay` after a run completes; and
- the label `Example run · hardcoded preview`.

### 4. Teams

Keep Startup Team as the prominent full-width team because it is the default
hero install. Add Finance Team and Market Team as equal companion cards beneath
it. Each card exposes its coordinator, member roster, copyable install command,
team detail route, and source link.

Finance Team and Market Team are featured here and are not duplicated as
ordinary workflow results in the Skill Hub. Their member skills still appear in
the deduplicated Skills catalog when appropriate.

### 5. Skill Hub and install guidance

Retain the existing Skill Hub behavior, query persistence, keyboard tab
navigation, empty states, and source-only skill links. Update only the content
and catalog filtering needed for the two new featured teams and their skills.

## Hardcoded demo cases

### Build a landing page

- Team: `startup-team`.
- Prompt: `$startup-goal Build and ship a landing page for an AI finance
  product.`
- Planning fan-out: product manager, web design, and founding engineer.
- Controlled handoff: the founding engineer returns an implementation frame;
  the implementation skill performs the write phase; QA verifies the result.
- Result: approved page direction, an implementation slice, and a verified
  release checklist.

This ordering preserves Startup Team's real contract: the founding engineer
does not edit files, implementation is a separate phase, and QA follows it.

### Research a stock

- Team: `finance-team`.
- Prompt: `$finance-research Research NVDA as a 12-month watchlist candidate
  using public sources.`
- Analysis fan-out: company analysis, financial analysis, and valuation
  analysis.
- Verification: risk analysis challenges the synthesized draft and source
  coverage.
- Result: a sourced thesis, valuation scenarios, catalysts, risks, and the
  conditions that would change the view.

The preview contains process and artifact descriptions, not hardcoded current
prices, ratios, earnings figures, or recommendations.

### Research the market

- Team: `market-team`.
- Prompt: `$market-research Assess whether U.S. equities are risk-on or fragile
  using macro, rates, breadth, and sector leadership.`
- Analysis fan-out: macro analysis, rates analysis, market structure, and sector
  analysis.
- Verification: risk analysis challenges the synthesized regime call.
- Result: a regime brief with scenario probabilities, triggers, and
  invalidation signals.

The preview does not claim to represent the current market. It shows the
structure of a professional research result.

## Finance Team contract

`examples/teams/finance-team` is a first-class team bundle:

- `kind: "team"`;
- coordinator: `./skills/finance-research`;
- members:
  - `catalog:company-analysis`;
  - `catalog:financial-analysis`;
  - `catalog:valuation-analysis`;
  - `catalog:risk-analysis`.

The coordinator is the one local entry skill. The four members are child
workflows under `examples/workflows/`, each with exactly one local entry skill.
Every coordinator/member source is declared in `skills[]` and receives a native
orchestration assignment.

Finance Team v1 covers public-company research only. Its coordinator asks for
the company or ticker, decision horizon, research question, as-of expectation,
and available source access before proposing a route. It then presents a brief
and requires approval before dispatch.

Core member responsibilities:

- `company-analysis`: business model, competitive position, primary filings,
  management claims, and material company events.
- `financial-analysis`: revenue, margins, cash flow, balance-sheet quality,
  accounting signals, and trend consistency.
- `valuation-analysis`: scenario assumptions, comparable or intrinsic frames,
  sensitivity, catalysts, and expectation risk.
- `risk-analysis`: contradictory evidence, missing sources, thesis failure
  modes, and conditions that would change the view.

Company, financial, and valuation work can run in parallel after approval.
Risk analysis runs against the combined draft as the verification phase.

## Market Team contract

`examples/teams/market-team` is a first-class team bundle:

- `kind: "team"`;
- coordinator: `./skills/market-research`;
- members:
  - `catalog:macro-analysis`;
  - `catalog:rates-analysis`;
  - `catalog:market-structure`;
  - `catalog:sector-analysis`;
  - `catalog:risk-analysis`.

The coordinator is the one local entry skill. The five members are child
workflows under `examples/workflows/`; `risk-analysis` is shared with Finance
Team. Every coordinator/member source is declared in `skills[]` and receives a
native orchestration assignment.

The coordinator asks for geography, asset scope, horizon, research question,
as-of expectation, and available source access before presenting an approval
brief.

Core member responsibilities:

- `macro-analysis`: growth, inflation, policy, liquidity, and the event calendar.
- `rates-analysis`: yield-curve shape, real and nominal rates, credit conditions,
  and rate-sensitive transmission.
- `market-structure`: breadth, volatility, positioning proxies, index
  concentration, and technical confirmation.
- `sector-analysis`: leadership, rotation, relative strength, and earnings or
  policy sensitivity.
- `risk-analysis`: contradictory signals, missing data, scenario failure modes,
  triggers, and invalidation.

Macro, rates, market-structure, and sector work can run in parallel after
approval. Risk analysis runs against the combined draft as the verification
phase.

## Specialist workflow shape

Create these independently valid child workflows under `examples/workflows/`:

- `company-analysis`;
- `financial-analysis`;
- `valuation-analysis`;
- `risk-analysis`;
- `macro-analysis`;
- `rates-analysis`;
- `market-structure`; and
- `sector-analysis`.

Each workflow has one local entry skill, a focused README, a minimal manifest,
and only the companion skills it genuinely needs. The entry skill defines its
input, source hierarchy, output contract, missing-data behavior, and handoff to
the parent coordinator. It must not silently broaden into personalized advice.

The public catalog aliases allow both teams to share `risk-analysis` while the
recursive resolver still writes only the root team install record.

## Source and evidence policy

The research teams are provider-neutral. They do not import a market SDK or
require a named commercial data service. Their skills instruct the host agent
to use available browsing/search tools and prefer auditable sources.

For Finance Team, the source order is:

1. Company filings and regulator-hosted records.
2. Company investor-relations materials and earnings releases.
3. Primary exchange, government, or issuer data.
4. Reputable secondary reporting for context, clearly identified as secondary.

For Market Team, the source order is:

1. Central bank, treasury, statistics-agency, regulator, and exchange sources.
2. Issuer or index-provider publications when relevant.
3. Reputable secondary reporting for context.

Every research output carries an as-of statement and source links when the host
supports them. If a required source is blocked, stale, conflicting, or absent,
the relevant member reports the limitation. The coordinator must not fill the
gap with an invented number or unsupported claim.

## Native orchestration policy

Both new coordinators and all analysis members use deep, read-only planning
profiles. `risk-analysis` uses the verification model role. A fast, read-only
explorer support profile may be declared for routine source discovery.

Neither team grants `workspace-write` access because their v1 result is a
research artifact returned to the user. The manifests do not include an
implementation phase.

The coordinator skills mirror the visible contract:

1. Clarify the question and source constraints.
2. Present a compact brief and wait for approval.
3. Select the smallest sufficient member set and disclose skipped members.
4. Preflight and dispatch verified role profiles.
5. Collect member artifacts.
6. Route the combined draft through risk verification.
7. Return one decision-ready research brief with limitations.

## Motion and interaction design

The approved visual model is a control-tower fan-out/fan-in flow.

### Sequence

1. **Clarify:** the goal packet enters the coordinator; the approval gate becomes
   visible.
2. **Dispatch:** one packet splits across the selected specialist lanes; role
   cards enter with a short stagger and show restrained progress.
3. **Collect:** completed artifacts return to the coordinator and converge into
   synthesis.
4. **Verify:** the final risk or QA gate passes before the result and install
   command appear.

The default landing-page case auto-plays once when at least half of the demo
enters the viewport. It does not loop. Selecting another case is explicit user
intent and starts that selected case. `Replay` reruns the active case. Timers
pause while the document is hidden.

Use 120–180 ms staggers and a total sequence around eight seconds. Motion should
communicate ownership and state change, not decorate the page.

### Responsive behavior

- Desktop: coordinator above a horizontal fan-out of specialist lanes, followed
  by convergence and verification.
- Mobile: the same order becomes a vertical stack—coordinator, specialists,
  combine, verify—without horizontal scrolling.
- The result and install command remain visible without requiring animation.

### Accessibility

- Respect `prefers-reduced-motion`: disable autoplay and movement, render the
  complete static flow, and keep case switching functional.
- Case selection uses a proper tablist with ArrowLeft, ArrowRight, Home, and End
  behavior.
- Replay and copy actions are real buttons with visible focus states.
- State is communicated through text and icons, not color alone.
- A polite live region announces meaningful phase changes without reading the
  full transcript repeatedly.

## Content ownership and components

- `landing/lib/landing-content.ts` owns hero copy, how-it-works copy, team card
  content, hardcoded case data, labels, results, commands, and source URLs.
- `landing/components/landing-page.tsx` owns page composition and the hero CTA,
  not durable copy.
- `landing/components/flow-diagram.tsx` renders the compact static orchestration
  model.
- `landing/components/workflow-run-demo.tsx` owns the demo state machine and
  presentational control-tower layout; it consumes case data rather than
  defining product copy inline.
- `landing/components/featured-team-section.tsx` remains the team presentation
  boundary and expands to render Startup Team plus the two companion research
  teams.
- `landing/lib/skill-hub.ts` derives the deduplicated workflow/skill catalog and
  excludes all featured teams from repeated workflow results.
- `docs/landing-content.md` and `docs/landing-content.zh-Hant.md` mirror the
  visible contract.

## Error and fallback behavior

- If IntersectionObserver is unavailable, show the ready static state and keep
  `Replay` available.
- If the document becomes hidden mid-run, pause timers and resume from the same
  phase when visible.
- If clipboard access fails, leave the complete command visible and selectable;
  do not show a false copied state.
- If JavaScript is unavailable, server-rendered copy, team cards, prompts,
  install commands, and a static orchestration diagram remain useful.
- If a team source or route is missing, source-contract tests fail rather than
  silently rendering a dead action.
- Research skills surface blocked, stale, conflicting, or missing evidence in
  their result instead of fabricating completeness.

## Documentation and lock policy

Update root README examples, architecture documentation, team READMEs, child
workflow READMEs, English landing content, and Traditional Chinese landing
content together.

Generate `workflow.lock.json` for each new public team and child workflow only
when the current lock policy can pin all catalog dependencies to a public commit
that contains them. During pre-publication, an omitted lock is valid and is
preferred over a fabricated or unresolvable lock. Tests must cover the chosen
state explicitly.

## Verification strategy

### Manifest and runtime

- Both team manifests validate as `kind: "team"`.
- Coordinators are local entry skills and are not repeated as members.
- Every member resolves to a child workflow with exactly one local entry skill.
- `risk-analysis` resolves consistently when shared by both teams.
- `deps`, recursive install planning, root-only records, list output, dry-run
  removal, and lock behavior are covered.
- Native orchestration assignments use deep planning roles, a verification role
  for risk analysis, and no workspace-write role.

### Landing source contracts

- The hero contains the approved Codex positioning and exact command.
- The old three startup-only cases are absent.
- All three cases contain the approved coordinator, specialist order, outcome,
  hardcoded-preview label, install command, detail route, and source URL.
- Finance Team and Market Team appear in the featured-team surface and do not
  repeat as ordinary Skill Hub workflows.
- Visible durable copy comes from `landing-content.ts`.
- English and Traditional Chinese mirrors stay aligned with the runtime source.

### Interaction and browser smoke

- Default case auto-plays once on viewport entry and never loops.
- Selecting a case starts that case; Replay restarts the active case.
- Hiding and restoring the document preserves phase correctly.
- Reduced-motion mode renders a complete static state without travel, sweep, or
  lift animations.
- Case tabs and actions work with keyboard navigation and visible focus.
- Status remains understandable without color.
- Clipboard success and failure states are accurate.
- Verify at 320 px, 768 px, and 1440 px with no clipping or horizontal scroll.

### Commands

Run focused checks while implementing, then finish with:

```bash
rtk bun run dev -- validate examples/teams/finance-team
rtk bun run dev -- deps examples/teams/finance-team
rtk bun run dev -- validate examples/teams/market-team
rtk bun run dev -- deps examples/teams/market-team
rtk bun run check
```

Run the landing app's own `rtk bun run check` from `landing/` as well as the
root repository gate. Use browser automation against a confirmed listening
development server for the responsive and interaction smoke checks.

## Rollback boundary

The change is separable into three reviewable slices:

1. Finance Team, Market Team, and their child workflows.
2. Landing content and control-tower demo.
3. Documentation, source-contract tests, and final polish.

Each slice can be reverted without changing the existing Startup Team manifest
contract. No implementation step may reset, overwrite, or absorb unrelated
worktree changes.
