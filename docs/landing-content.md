# Omniskills Landing Content

Agent-readable Markdown mirror for the Omniskills landing page.

Runtime source of truth: `landing/lib/landing-content.ts`.

Component-local page copy also comes from `landing/components/landing-page.tsx`,
`landing/components/workflow-run-demo.tsx`, and
`landing/app/workflows/[slug]/page.tsx`.

## Hero

Eyebrow: Works with Claude, Codex, Cursor, opencode, and GitHub Copilot.

Headline:

```text
Power your ability.
Install the workflow.
```

Body: Omniskills is a many-skill bank for AI agents. Install one workflow
skill tree, call one entry skill with a goal, and give your agent the roles,
playbooks, and verification habits that 3x your ability.

Primary command preview:

```bash
npx omniskill@latest install startup-team
```

Primary action: Explore teams & skills.

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
- opencode
  - id: `opencode`
- GitHub Copilot
  - id: `github-copilot`
  - logo: `/agent-logos/github-copilot.svg`

## How It Works

Section label: How it works.

Heading: One entry skill. Many specialist skills.

1. Install a many-skill bank

   A workflow manifest defines the callable entry skill plus every local or
   external specialist skill it needs.

2. Call one entry skill with a goal

   Users invoke a single skill, such as $startup-goal, and the workflow routes
   the goal through the right roles.

3. Compound specialist judgment

   Strategy, product, architecture, delivery, implementation, and QA roles stay
   aligned so the agent can 3x your ability without manual skill juggling.
   Looped workflows can track resumable, action-only workflow state through the
   CLI.

## Workflow Run Demo

Section label: Try it live.

Heading: Watch the workflow run.

Body: Simulate calling `$startup-goal` and see each role skill return its part
of the combined answer.

Prompt:

```text
> $startup-goal help me launch this product from idea to shipped v1
```

Demo steps:

1. Route Goal
   - skill: `startup-goal`
   - lines:
     - Reading goal: launch this product from idea to shipped v1
     - Selecting the role skills needed for the next decision
     - Dispatching CEO, CTO, PM, EM, founding engineer, and QA lead
     - Startup Goal route assembled
2. Strategy
   - skill: `ceo`
   - lines:
     - Clarifying customer, wedge, and first painful workflow
     - Choosing launch learning over broad platform scope
     - Naming the hard tradeoff: speed before breadth
     - CEO strategy frame returned
3. Product Scope
   - skill: `product-manager`
   - lines:
     - Translating strategy into user problem and v1 promise
     - Writing acceptance criteria for the first useful demo
     - Slicing launch work into docs, onboarding, and feedback loop
     - PM scope and issue slices returned
4. Architecture
   - skill: `cto`
   - lines:
     - Checking the workflow manifest and install path
     - Flagging integration risk around external skill dependencies
     - Keeping the entry skill thin and role coordination explicit
     - CTO architecture guardrails returned
5. Implementation
   - skill: `founding-engineer`
   - lines:
     - Finding the smallest implementation slice
     - Updating the manifest, README, and landing source contract
     - Running focused tests before the repo gate
     - Verified implementation path returned
6. QA Review
   - skill: `qa-lead`
   - lines:
     - Checking acceptance against the original startup goal
     - Scanning for stale startup-team and OpenSpec-facing examples
     - Separating verified facts from residual launch risk
     - Combined startup answer ready

Completion copy: Workflow complete - all 6 role steps returned. Startup answer
ready.

## Omniskills Teams

Section label: Omniskills Teams.

Heading: Pick an Omniskills team.

Body: Start with a coordinated team when one role is not enough. One install
gives your agent a coordinator, specialist roles, and the playbooks that
connect them.

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

Description: Move one startup goal from direction to delivery with a
coordinator that brings in strategy, product, design, engineering, and QA only
when the work needs them.

Coordinator: `$startup-goal` — Clarifies the brief, selects the needed roles,
and combines their outputs.

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
- `emilkowalski:emil-design-eng`: Polish interface implementation
- `emilkowalski:animation-vocabulary`: Name and select motion patterns
- `emilkowalski:apple-design`: Apply Apple design principles
- `emilkowalski:review-animations`: Review motion quality
- `superpowers:brainstorming`: Explore options before scope locks
- `superpowers:writing-plans`: Create executable plans
- `superpowers:verification-before-completion`: Verify before claiming done
- `mattpocock:wayfinder`: Map decisions and uncertainty
- `mattpocock:grill-with-docs`: Stress-test direction
- `mattpocock:to-spec`: Write product requirements
- `mattpocock:to-tickets`: Slice work into issues
- `mattpocock:codebase-design`: Review codebase boundaries
- `mattpocock:domain-modeling`: Name domain concepts
- `mattpocock:tdd`: Build with tests where practical
- `mattpocock:diagnosing-bugs`: Diagnose failures from evidence
- `mattpocock:code-review`: Review behavior and risk
- `mattpocock:implement`: Execute the implementation slice

Ordered skill path:

1. Route -> `startup-goal`
   - Dispatch the needed role subagents for the next decision.
2. Strategy -> `ceo`
   - Clarify company direction and tradeoffs.
3. Product -> `product-manager`
   - Shape customer value, PRD, and issue slices.
4. Design -> `web-design`
   - Set responsive interface direction and motion quality.
5. Technology -> `cto`
   - Set architecture and technical risk boundaries.
6. Delivery -> `engineering-manager`
   - Sequence execution and quality gates.
7. Implementation frame -> `founding-engineer`
   - Prepare the smallest correct implementation slice.
8. Implement -> `mattpocock:implement`
   - Execute the planned change with tests and review.
9. QA -> `qa-lead`
   - Check release readiness and residual risk.

## Skill Hub

Heading: Explore the Skill Hub.

Body: Browse independently installable workflows or inspect the skills they
assemble.

Tabs:

- Workflows
  - Search placeholder: Search workflows, entry skills, or tags...
  - Results exclude Startup Team because it is featured above.
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

The independently installable workflow catalog starts below. Startup Team is
not repeated here.

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
- tag: Build
- entry skill: `$founding-engineer`
- avatar seed: `sha256:2c1ee7f8710c90004a958f81aa84321fad2efc83d8839fede97689f6ebf1b078`
- accent: `text-[#c83c24]`
- source: `https://github.com/devos-ing/omni-skills/tree/main/examples/workflows/founding-engineer`
- install:

```bash
npx omniskill@latest install founding-engineer
```

Description: Implementation lane for the smallest correct change: tests,
debugging, review, and verification.

Skills:

- `founding-engineer`: Set the implementation frame
- `mattpocock:implement`: Implement the planned change
- `mattpocock:tdd`: Use test-first development
- `mattpocock:diagnosing-bugs`: Diagnose failures
- `mattpocock:code-review`: Review behavior and risk
- `superpowers:verification-before-completion`: Verify completion

Ordered skill path:

1. Brief -> `founding-engineer`
   - Read the plan and acceptance criteria.
2. Implement -> `mattpocock:implement`
   - Ship the smallest correct slice.
3. TDD -> `mattpocock:tdd`
   - Keep tests close to changed behavior.
4. Debug -> `mattpocock:diagnosing-bugs`
   - Debug from evidence when checks fail.
5. Review -> `mattpocock:code-review`
   - Review risks and behavior.
6. Verify -> `superpowers:verification-before-completion`
   - Run final checks before handoff.

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
