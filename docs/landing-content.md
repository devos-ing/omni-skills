# Omniskills Landing Content

Agent-readable Markdown mirror for the Omniskills landing page.

Runtime source of truth: `landing/lib/landing-content.ts`.

Component-local page copy also comes from `landing/components/landing-page.tsx`,
`landing/components/workflow-run-demo.tsx`, and
`landing/app/workflows/[slug]/page.tsx`.

## Hero

Eyebrow: Orchestration for Codex.

Headline:

```text
One goal. A team of agents. One verified result.
```

Body: Turn Codex into a coordinated team. One entry skill clarifies the goal,
routes the right specialists, brings their work back together, and verifies the
result. Claude, Cursor, opencode, and GitHub Copilot remain supported too.

Primary command preview:

```bash
npx omniskill@latest install startup-team
```

Primary action: Watch a team run.

## Supported Agents

- Claude
  - id: `claude`
  - logo: `/agent-logos/claude.svg`
- Codex
  - id: `codex`
  - logo: `/agent-logos/openai.svg`
- Cursor
  - id: `cursor`
  - logo: `/agent-logos/cursor.svg`
- OpenCode
  - id: `opencode`
- Hermes
  - id: `hermes`
- OpenClaw
  - id: `openclaw`
- GitHub Copilot
  - id: `github-copilot`
  - logo: `/agent-logos/github-copilot.svg`

## How It Works

Section label: How orchestration works.

1. Install a real team
   - One Omniskills manifest installs a coordinator, specialist roles, and the source-linked playbooks that connect them.
2. Give the coordinator one goal
   - Call one entry skill. It clarifies scope, waits for approval, and routes only the roles the goal needs.
3. Verify before feature acceptance
   - Implementation and any bounded rework return evidence to QA, then User Outcome Replay checks the verified result before the final human gate.

### Two human gates

You approve the plan and accept the feature. The milestone stops before
implementation and again after QA and User Outcome Replay. Scope changes return
to planning instead of becoming invisible assumptions.

## FAQ

### How are Startup Team installs and local research previews kept safe?

Startup Team carries a checked-in schema 0.2 lock with exact-commit external
locators, and its declared members resolve from the same checkout. Managed
refreshes require recorded ownership; mixed ownership fails closed. Finance Team
and Market Team remain lockless local previews.

### Which CLI command installs a workflow or team?

Use install as the public install command. bundle and workflow remain
compatibility aliases.

## Control Tower Demo

Section label: Control tower.

Heading: Watch Codex orchestrate a real team.

Disclosure: `Example run · hardcoded preview`. The cases are deterministic
previews of real installable manifests, not live agent or market-data sessions.

Cases:

1. Build a landing page — `$startup-goal`
   - Coordinator activity: Launch selected installed roles.
   - Product, design, and engineering planning run in parallel.
   - Implementation and QA run as sequential gates before the verified result.
   - Implement source: `https://github.com/mattpocock/skills/blob/d574778f94cf620fcc8ce741584093bc650a61d3/skills/engineering/implement/SKILL.md`.
2. Research a stock — `$finance-research`
   - Coordinator activity: Prepare selected specialist handoffs.
   - Company, financial, and valuation specialists work in parallel.
   - `$risk-analysis` challenges the thesis, sources, and invalidation conditions.
3. Research the market — `$market-research`
   - Coordinator activity: Prepare selected specialist handoffs.
   - Macro, rates, market-structure, and sector specialists work in parallel.
   - `$risk-analysis` verifies contradictory signals, triggers, and invalidation.

## Omniskills Teams

Section label: Omniskills Teams.

Heading: Pick the team for the goal.

Body: Install a real coordinator and its specialist roles together. Startup
Team ships product work; Finance Team researches public companies; Market Team
builds a sourced regime view.

### Startup Team

- slug: `startup-team`
- tag: Team
- entry skill: `$startup-goal`
- avatar seed: `sha256:e2445fdfee4ef3d0a8aae8333a820a8485338bd1f62674c2596be49dba878f5f`
- accent: `text-[#c83c24]`
- source: `https://github.com/devos-ing/omni-skills/tree/main/examples/teams/startup-team`
- install:

```bash
npx omniskill@latest install startup-team
```

Description: Move one approved startup feature at a time through plan approval,
implementation, conditional rework, QA, User Outcome Replay, and human feature
acceptance.

Coordinator: `$startup-goal` — Controls the Goal Tunnel and Evidence Ledger,
runs selected installed roles as internal subagents with bounded stage packets,
and holds both human approval gates. Prepared, not executed is the fallback when
the host launch capability or role profile is unavailable; public CLI dispatch
stays disabled.

Members:

- CEO — Company direction and tradeoffs
- CTO — Architecture and technical risk
- Product Manager — Discovery, PRDs, and issue slicing
- Web Design — Interface direction and motion quality
- Engineering Manager — Delivery sequencing and quality gates
- Founding Engineer — Implementation framing and handoff
- QA Lead — Acceptance checks and release risk

Actions: `View team` opens `/workflows/startup-team`; `View team source` opens
`https://github.com/devos-ing/omni-skills/tree/main/examples/teams/startup-team`.

Skills:

- `startup-goal`: Coordinate role subagents around one goal
- `ceo`: Company direction and tradeoffs
- `cto`: Architecture and technical risk
- `product-manager`: Discovery, PRDs, and issue slicing
- `web-design`: Interface direction and motion quality
- `engineering-manager`: Delivery sequencing and quality gates
- `founding-engineer`: Implementation framing and handoff
- `qa-lead`: Acceptance checks and release risk
- `superpowers:brainstorming`: Explore options before scope locks
- `mattpocock:implement`: Execute the implementation slice
- `setup-model-routing`: Configure global Codex model roles

Ordered milestone path:

`Prepare -> Plan -> Plan approval -> Implement -> Rework if needed -> Verify -> User Outcome Replay -> Feature acceptance`

1. Prepare -> `startup-goal`
   - Define the Goal Tunnel, feature milestone, role inputs, and acceptance criteria.
2. Plan -> `startup-goal`
   - Validate role outputs and the Evidence Ledger without prescribing expert methods.
3. Plan approval -> `startup-goal`
   - Wait for explicit human approval of the implementation boundary.
4. Implement -> `mattpocock:implement`
   - Execute only the approved milestone slice.
5. Rework if needed -> `mattpocock:implement`
   - Make one bounded in-scope repair, then return fresh evidence to QA.
6. Verify -> `qa-lead`
   - Record acceptance evidence, regressions, untested areas, and residual risk.
7. User Outcome Replay -> `startup-goal`
   - Reconstruct expectations, needs, wishes, and journey after QA.
8. Feature acceptance -> `startup-goal`
   - Wait for explicit human acceptance before activating the next milestone.

Distribution and safety: Startup Team carries a checked-in schema `0.2` lock,
uses exact-commit external locators, and resolves every declared member from the
same checkout. Managed refreshes require recorded ownership of existing paths;
mixed ownership fails closed. Finance Team and Market Team remain lockless local
previews.

### Finance Team (local preview)

- slug: `finance-team`
- entry skill: `$finance-research`
- source: `https://github.com/devos-ing/omni-skills/tree/main/examples/teams/finance-team`
- repository-local install:

```bash
bun run dev -- install examples/teams/finance-team
```

Coordinator: `$finance-research`. Members: `$company-analysis`,
`$financial-analysis`, `$valuation-analysis`, and shared `$risk-analysis`.
This alias is not published through `omniskill@latest` yet. The coordinator
prepares manual specialist handoffs, returns `Prepared, not executed`, and
combines only completed outputs. Uses host browsing and public sources, requires
no market-data API, and does not provide personalized investment advice.

### Market Team (local preview)

- slug: `market-team`
- entry skill: `$market-research`
- source: `https://github.com/devos-ing/omni-skills/tree/main/examples/teams/market-team`
- repository-local install:

```bash
bun run dev -- install examples/teams/market-team
```

Coordinator: `$market-research`. Members: `$macro-analysis`, `$rates-analysis`,
`$market-structure`, `$sector-analysis`, and shared `$risk-analysis`. Uses host
browsing and public sources, requires no market-data API, and does not provide
personalized investment advice. This alias is not published through
`omniskill@latest` yet. The coordinator prepares manual specialist handoffs,
returns `Prepared, not executed`, and combines only completed outputs.

## Skill Hub

Heading: Explore the Skill Hub.

Body: Browse independently installable workflows or inspect the skills they
assemble.

Tabs:

- Workflows
  - Search placeholder: Search workflows, entry skills, or tags...
  - Results exclude Startup, Finance, and Market teams because they are featured above.
  - Each result opens its workflow detail route through `View workflow`.
  - Empty state: No workflows match the current query; `Clear search` resets it.
- Skills
  - Search placeholder: Search skills, providers, or packages...
  - Each canonical skill appears once with its provider and every package that
    includes it.
  - `View skill source` is the only skill action and opens the canonical source.
  - No standalone skill install command is shown or implied.
  - Empty state: No skills match the current query; `Clear search` resets it.

The query persists across Workflows and Skills. Canonical source identity
deduplicates aliases such as `implement` and `mattpocock:implement` while the
package relationships remain visible.

### Workflows

The independently installable workflow catalog starts below. Featured teams
are not repeated here.

### CEO

- slug: `ceo`
- tag: Strategy
- entry skill: `$ceo`
- avatar seed: `sha256:e28e960ca32f944aad4353c9248e43ca7526a5f4451d1293cd79590878f2b25a`
- accent: `text-[#c83c24]`
- source: `https://github.com/devos-ing/omni-skills/tree/main/examples/workflows/ceo`
- install:

```bash
npx omniskill@latest install ceo
```

Description: Founder-level strategy for direction, hard tradeoffs,
fundraising/customer framing, and company decisions.

Skills:

- `ceo`: Set the executive frame
- `mattpocock:wayfinder`: Map strategic uncertainty
- `mattpocock:grill-with-docs`: Stress-test the company direction

Ordered skill path:

1. Brief -> `ceo`
   - State the company-level decision.
2. Decision Map -> `mattpocock:wayfinder`
   - Map options, constraints, and uncertainties.
3. Grill -> `mattpocock:grill-with-docs`
   - Stress-test the direction before committing.

### CTO

- slug: `cto`
- tag: Architecture
- entry skill: `$cto`
- avatar seed: `sha256:644afba52d60f4bbcf9a608c6ead98688650e9fc3f8ed0a63ac0d30ca4931156`
- accent: `text-[#c83c24]`
- source: `https://github.com/devos-ing/omni-skills/tree/main/examples/workflows/cto`
- install:

```bash
npx omniskill@latest install cto
```

Description: Technical leadership for architecture, domain model, platform
direction, and engineering risk.

Skills:

- `cto`: Set the technical frame
- `mattpocock:codebase-design`: Review module boundaries
- `mattpocock:domain-modeling`: Clarify domain concepts
- `mattpocock:diagnosing-bugs`: Diagnose technical risk
- `mattpocock:code-review`: Review behavior and risk

Ordered skill path:

1. Brief -> `cto`
   - Identify the technical trajectory decision.
2. Domain -> `mattpocock:domain-modeling`
   - Name the business concepts before abstractions.
3. Architecture -> `mattpocock:codebase-design`
   - Review boundaries and interfaces.
4. Risk -> `mattpocock:diagnosing-bugs`
   - Diagnose failures and fragile assumptions.
5. Review -> `mattpocock:code-review`
   - Check behavior, blast radius, and tradeoffs.

### Product Manager

- slug: `product-manager`
- tag: Product
- entry skill: `$product-manager`
- avatar seed: `sha256:c0c7094ce1e2d9c614bd9939d9a379f488d809b0316d568017f584263f1eab8f`
- accent: `text-[#c83c24]`
- source: `https://github.com/devos-ing/omni-skills/tree/main/examples/workflows/product-manager`
- install:

```bash
npx omniskill@latest install product-manager
```

Description: Product discovery, PRDs, acceptance criteria, roadmap tradeoffs,
and issue slicing.

Skills:

- `product-manager`: Frame the product problem
- `superpowers:brainstorming`: Explore product options
- `mattpocock:to-spec`: Write the product specification
- `mattpocock:to-tickets`: Slice delivery tickets
- `superpowers:writing-plans`: Write the delivery plan

Ordered skill path:

1. Brief -> `product-manager`
   - Name the user, pain, and desired behavior change.
2. Brainstorm -> `superpowers:brainstorming`
   - Explore product options before locking scope.
3. PRD -> `mattpocock:to-spec`
   - Write the requirement and acceptance criteria.
4. Issues -> `mattpocock:to-tickets`
   - Slice the PRD into visible progress.
5. Plan -> `superpowers:writing-plans`
   - Turn scope into executable delivery steps.

### Engineering Manager

- slug: `engineering-manager`
- tag: Delivery
- entry skill: `$engineering-manager`
- avatar seed: `sha256:70d97c45ac61d3774317681dc7ae318126e14a3d0b19f00183d8227ca0fb1071`
- accent: `text-[#c83c24]`
- source: `https://github.com/devos-ing/omni-skills/tree/main/examples/workflows/engineering-manager`
- install:

```bash
npx omniskill@latest install engineering-manager
```

Description: Delivery sequencing, execution risk, quality gates, blocker
triage, and engineering process.

Skills:

- `engineering-manager`: Set the delivery frame
- `superpowers:writing-plans`: Write the execution plan
- `mattpocock:tdd`: Choose the test strategy
- `mattpocock:diagnosing-bugs`: Triage blockers
- `mattpocock:code-review`: Review behavior and risk

Ordered skill path:

1. Brief -> `engineering-manager`
   - Identify the shippable outcome and delivery risk.
2. Plan -> `superpowers:writing-plans`
   - Sequence work into verifiable steps.
3. Quality -> `mattpocock:tdd`
   - Pick test gates by blast radius.
4. Debug -> `mattpocock:diagnosing-bugs`
   - Triage blockers from evidence.
5. Review -> `mattpocock:code-review`
   - Review delivery risk before handoff.

### Founding Engineer

- slug: `founding-engineer`
- tag: Plan
- entry skill: `$founding-engineer`
- avatar seed: `sha256:2c1ee7f8710c90004a958f81aa84321fad2efc83d8839fede97689f6ebf1b078`
- accent: `text-[#c83c24]`
- source: `https://github.com/devos-ing/omni-skills/tree/main/examples/workflows/founding-engineer`
- install:

```bash
npx omniskill@latest install founding-engineer
```

Description: Read-only implementation frame: identify seams, tests, failure
evidence, review risk, and a handoff to a separate implementer. It does not edit
files or run implementation commands.

Skills:

- `founding-engineer`: Set the read-only implementation frame
- `mattpocock:tdd`: Identify required test seams
- `mattpocock:diagnosing-bugs`: Frame failure evidence
- `mattpocock:code-review`: Identify behavior and review risk
- `superpowers:verification-before-completion`: Define completion checks

Ordered skill path:

1. Brief -> `founding-engineer`
   - Read the plan and acceptance criteria.
2. Tests -> `mattpocock:tdd`
   - Identify tests that keep evidence close to changed behavior.
3. Diagnose -> `mattpocock:diagnosing-bugs`
   - Specify the evidence needed if checks fail.
4. Review -> `mattpocock:code-review`
   - Identify risks and behavior to review.
5. Checks -> `superpowers:verification-before-completion`
   - Define final checks for the implementation handoff.

### QA Lead

- slug: `qa-lead`
- tag: Quality
- entry skill: `$qa-lead`
- avatar seed: `sha256:17b5f20fa744bdbc0791717b5705e8be940b7cbdfaf4d5604e9d6a6a19124a53`
- accent: `text-[#c83c24]`
- source: `https://github.com/devos-ing/omni-skills/tree/main/examples/workflows/qa-lead`
- install:

```bash
npx omniskill@latest install qa-lead
```

Description: Release-risk lens for acceptance checks, regression focus,
reproduction gaps, and verification evidence.

Skills:

- `qa-lead`: Set the release-risk frame
- `mattpocock:code-review`: Review behavior and risk
- `mattpocock:diagnosing-bugs`: Diagnose failures
- `superpowers:verification-before-completion`: Verify before handoff

Ordered skill path:

1. Brief -> `qa-lead`
   - Restate the user-facing behavior that must be true.
2. Review -> `mattpocock:code-review`
   - Review acceptance and release risk.
3. Debug -> `mattpocock:diagnosing-bugs`
   - Identify reproduction gaps and failure evidence.
4. Verify -> `superpowers:verification-before-completion`
   - Separate verified facts from residual risk.

### Codex Input Preview

- slug: `codex-input-preview`
- tag: Workflow
- entry skill: `$codex-input-preview`
- avatar seed: `sha256:badcaa276e46a5648ede65d2d0cb3429ca4dd81b0443420b9c72ad704d79a1bd`
- accent: `text-[#5f5ce6]`
- source: `https://github.com/devos-ing/omni-skills/tree/main/examples/workflows/codex-input-preview`
- install:

```bash
npx omniskill@latest install codex-input-preview
```

Description: Turn a prompt, model label, and reasoning effort into a faithful
1200 × 675 simulated Codex composer PNG.

Skills:

- `codex-input-preview`: Render one verified Codex composer PNG

Ordered skill path:

1. Render -> `codex-input-preview`
   - Fit the prompt, capture the composer, and verify exact PNG dimensions.

Example output:

- image: `/examples/codex-input-preview.png`
- alt: Simulated Codex input showing “Help me announce that I’m joining the Codex team!” with GPT-5.6 and high effort.
- invocation: `$codex-input-preview Draw “Help me announce that I’m joining the Codex team!” using GPT-5.6 with high effort.`
- disclosure: Simulated Codex composer preview — not a live Codex session.

### Haaland

- slug: `haaland`
- tag: Meme
- entry skill: `$haaland`
- avatar seed: `sha256:d10bf16eca98054b3a23bbe0aac21ccb00e7f904c5f3b1c3480bb1009c575583`
- accent: `text-[#c83c24]`
- source: `https://github.com/devos-ing/omni-skills/tree/main/examples/workflows/haaland`
- install:

```bash
npx omniskill@latest install haaland
```

Description: A one-shot JTS meme workflow for a football-finisher caption,
parody post concept, and original Haaland profile icon asset.

Skills:

- `haaland`: Create one profile-icon meme concept

Ordered skill path:

1. One Shot -> `haaland`
   - Create one caption and profile icon placement note.

## Common Commands

Section label: Common commands.

Heading: Get up and running fast.

Body: Install by alias, public git URL, or local path. The CLI validates the
workflow manifest, bootstraps missing external skills from workflow metadata,
and records installed Omniskills workflows under `~/.omniskills/workflows/` by
default. Loop-enabled workflows use `omniskill loop` for resumable,
action-only state.

### Install Startup Team

```bash
npx omniskill@latest install startup-team
```

### Inspect Startup Team deps

```bash
npx omniskill@latest deps startup-team
```

### Configure model routing

```bash
npx omniskill@latest setup-model-routing
```

### Lock skill fingerprints

```bash
npx omniskill@latest lock examples/teams/startup-team
```

### Check loop status

```bash
npx omniskill@latest loop status grilled-product-dev --latest --json
```

### Create your own workflow

```bash
npx omniskill@latest init my-workflow
```

### Validate before sharing

```bash
npx omniskill@latest validate my-workflow
```

### List installed Omniskills workflows

```bash
npx omniskill@latest list
```

### Remove installed workflow

```bash
npx omniskill@latest remove startup-team
```

Then invoke in your agent:

```text
> $startup-goal help me launch this product from idea to shipped v1

[ok] CEO        framed strategy and tradeoffs
[ok] PM         scoped the v1 promise
[ok] CTO        set architecture guardrails
[ok] EM         sequenced delivery risk
[ok] engineer   selected the smallest implementation slice
[ok] QA         checked release risk and evidence
```

## Author Your Own Workflow

Badge: Author your own workflow.

Heading: Package your workflow as an Omniskills workflow.

Body: Scaffold a bundle, define the entry skill, list sub-skills in
workflow.json, validate, and share. The authoring guide keeps the skill tree
aligned.

Command:

```bash
npx omniskill@latest init my-workflow
```

Author guide:
`https://github.com/devos-ing/omni-skills/blob/main/docs/workflow-author-guide.md`

## Links

- GitHub: `https://github.com/devos-ing/omni-skills`
- Docs: `https://github.com/devos-ing/omni-skills/blob/main/README.md`
- Author Guide:
  `https://github.com/devos-ing/omni-skills/blob/main/docs/workflow-author-guide.md`
