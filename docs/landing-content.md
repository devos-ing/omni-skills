# GetSuperpower Landing Content

Agent-readable Markdown mirror for the GetSuperpower landing page.

Runtime source of truth: `landing/lib/landing-content.ts`.

Component-local page copy also comes from `landing/components/landing-page.tsx`,
`landing/components/workflow-run-demo.tsx`, and
`landing/app/workflows/[slug]/page.tsx`.

## Hero

Eyebrow: Works with Claude, Codex, Cursor, opencode, and GitHub Copilot.

Headline:

```text
One command.
Whole workflow.
```

Body: GetSuperpower packages a complete AI-agent workflow as a single callable
skill. Install once, invoke the entry skill, and the agent follows every
required sub-skill in order.

Primary command preview:

```bash
npx getsuperpower@latest install ...
```

Primary action: Browse workflows.

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

Heading: Install the skill tree. Invoke once.

1. workflow.json installs the skill tree

   A single manifest defines the callable entry skill and every local or
   external sub-skill it needs.

2. The entry skill is the one command users call

   Users invoke a single skill, such as $openspec-delivery, and the workflow
   coordinates the rest.

3. Sub-skills run in a deliberate order

   Proposal, design, planning, TDD, verification, and archive steps stay aligned
   without manual juggling.

## Workflow Run Demo

Section label: Try it live.

Heading: Watch the workflow run.

Body: Simulate calling `$openspec-delivery` and see each sub-skill execute in
order, just like your agent would.

Prompt:

```text
> $openspec-delivery implement idempotency for /payments/charge
```

Demo steps:

1. OpenSpec Proposal
   - skill: `opsx-propose`
   - lines:
     - Reading current OpenSpec contract...
     - Identifying change surface: /payments/charge endpoint
     - Drafting spec amendment - adding idempotency-key header
     - Aligning with existing versioning conventions
     - Spec proposal written -> openspec-proposal.md
2. Design Brainstorm
   - skill: `brainstorming`
   - lines:
     - Exploring approach A: client-generated UUID header
     - Exploring approach B: server-side dedup store (Redis TTL)
     - Exploring approach C: database unique constraint + retry
     - Evaluating tradeoffs: latency, storage, failure modes
     - Selected: approach B - best balance of correctness & perf
     - Design decision recorded -> brainstorm-notes.md
3. Implementation Plan
   - skill: `writing-plans`
   - lines:
     - Breaking spec into ordered tasks...
     - [1] Add idempotency middleware to Express stack
     - [2] Provision Redis dedup store with 24h TTL
     - [3] Wire idempotency-key header validation
     - [4] Return cached response on duplicate key
     - Plan written -> implementation-plan.md (4 tasks)
4. TDD Build
   - skill: `tdd-build`
   - lines:
     - Writing failing tests first...
     - should reject missing idempotency-key
     - should return 200 on first request
     - should return cached response on duplicate
     - Implementing middleware...
     - should reject missing idempotency-key
     - should return 200 on first request
     - should return cached response on duplicate
     - All 3 tests passing - coverage 94%

Completion copy: Workflow complete - all 4 skills executed. Artifacts saved to
workspace.

## Workflow Bundles

Section label: Workflow bundles.

Heading: Pick a GetSuperpower.

Body: Each workflow is a shareable bundle of skills with one entry point.

Search placeholder: Search workflows, skills, tags...

### OpenSpec Delivery

- slug: `openspec-delivery`
- tag: Featured
- entry skill: `$openspec-delivery`
- accent: `text-violet-300`
- source:
  `https://github.com/0xroylee/getsuperpower/tree/main/examples/workflows/openspec-superpowers`
- install:

```bash
npx getsuperpower@latest install 'https://github.com/0xroylee/getsuperpower.git#examples/workflows/openspec-superpowers'
```

Description: A complete delivery lifecycle from proposal through design, TDD
build, verification, and archive.

Skills:

- `opsx-propose`: Draft the scoped spec change
- `brainstorming`: Explore viable design approaches
- `writing-plans`: Create an executable implementation plan
- `tdd-build`: Build task by task with tests first
- `pony-trail`: Record verification and rollback context

Ordered skill path:

1. Proposal -> `opsx-handoff-review`
   - Create proposal, specs, and task handoff.
2. Design -> `superpowers:brainstorming`
   - Explore approaches and get human approval.
3. Plan -> `superpowers:writing-plans`
   - Split approved scope into executable tasks.
4. Build -> `mattpocock:tdd`
   - Implement each slice with failing tests first.
5. Evidence -> `pony-trail`
   - Record verification, rationale, and rollback context.
6. Archive -> `opsx-handoff-review`
   - Update specs and project knowledge after delivery.

### Release Review

- slug: `release-review`
- tag: Starter
- entry skill: `$release-review`
- accent: `text-sky-300`
- source:
  `https://github.com/0xroylee/getsuperpower/tree/main/examples/workflows/release-review`
- install:

```bash
npx getsuperpower@latest install 'https://github.com/0xroylee/getsuperpower.git#examples/workflows/release-review'
```

Description: A lightweight workflow for shaping release risk, reviewing diffs,
and preserving evidence.

Skills:

- `shape`: Clarify the release request
- `release-risk-review`: Flag risk by surface area
- `writing-plans`: Plan the release follow-through
- `pony-trail`: Capture evidence and rollback notes

Ordered skill path:

1. Shape -> `shape`
   - Clarify the release goal and constraints.
2. Risk Review -> `release-risk-review`
   - Review the diff for release risks.
3. Plan -> `writing-plans`
   - Write concrete follow-through tasks.
4. Evidence -> `pony-trail`
   - Preserve checks, rationale, and rollback notes.

### Real Engineering

- slug: `real-engineering`
- tag: Advanced
- entry skill: `$real-engineering`
- accent: `text-amber-300`
- source:
  `https://github.com/0xroylee/getsuperpower/tree/main/examples/workflows/real-engineering`
- install:

```bash
npx getsuperpower@latest install 'https://github.com/0xroylee/getsuperpower.git#examples/workflows/real-engineering'
```

Description: Combines RTK, pony-trail, Superpowers, and Matt Pocock skills for
TypeScript-heavy engineering.

Skills:

- `rtk`: Token-efficient command execution
- `mattpocock:tdd`: Focused red-green-refactor loops
- `superpowers:verify`: Completion checks before delivery
- `pony-trail`: Decision snapshots around file changes

Ordered skill path:

1. Run -> `rtk`
   - Use token-efficient commands for repo work.
2. Test -> `mattpocock:tdd`
   - Drive behavior with focused tests.
3. Verify -> `superpowers:verification-before-completion`
   - Check completion claims before handoff.
4. Record -> `pony-trail`
   - Snapshot file-change intent and evidence.

### Development Design Delivery

- slug: `development-design-delivery`
- tag: Product
- entry skill: `$development-design-delivery`
- accent: `text-emerald-300`
- source:
  `https://github.com/0xroylee/getsuperpower/tree/main/examples/workflows/development-design-delivery`
- install:

```bash
npx getsuperpower@latest install 'https://github.com/0xroylee/getsuperpower.git#examples/workflows/development-design-delivery'
```

Description: Product-minded engineering from shape to interface design, plan,
TDD, review, and evidence.

Skills:

- `brainstorming`: Shape the feature and constraints
- `design-an-interface`: Explore interface directions
- `writing-plans`: Split the work into small tasks
- `tdd`: Build through public seams
- `review`: Check behavior and risks

Ordered skill path:

1. Shape -> `brainstorming`
   - Clarify the product problem and constraints.
2. Design -> `design-an-interface`
   - Explore interface directions before building.
3. Plan -> `writing-plans`
   - Break the approved design into implementation tasks.
4. Build -> `tdd`
   - Implement through public behavior seams.
5. Review -> `review`
   - Check risks, behavior, and evidence.

## Common Commands

Section label: Common commands.

Heading: Get up and running fast.

Body: Install from npm, git, or a local path. The CLI handles validation,
dependency resolution, and local workflow records under `.getsuperpower/`.

### Install OpenSpec Delivery

```bash
npx getsuperpower@latest install 'https://github.com/0xroylee/getsuperpower.git#examples/workflows/openspec-superpowers'
```

### Install Release Review

```bash
npx getsuperpower@latest install 'https://github.com/0xroylee/getsuperpower.git#examples/workflows/release-review'
```

### List installed GetSuperpowers

```bash
npx getsuperpower@latest list
```

### Create your own workflow

```bash
npx getsuperpower@latest init my-workflow
```

### Validate before sharing

```bash
npx getsuperpower@latest validate my-workflow
```

Then invoke in your agent:

```text
> $openspec-delivery implement this OpenSpec change

[ok] proposal   scoped the change
[ok] design     selected the approach
[ok] plan       wrote executable tasks
[ok] TDD        built through public seams
[ok] archive    preserved project knowledge
```

## Author Your Own Workflow

Badge: Author your own workflow.

Heading: Package your workflow as a GetSuperpower.

Body: Scaffold a bundle, define the entry skill, list sub-skills in
workflow.json, validate, and share. The authoring guide keeps the skill tree
aligned.

Command:

```bash
npx getsuperpower@latest init my-workflow
```

Author guide:
`https://github.com/0xroylee/getsuperpower/blob/main/docs/workflow-author-guide.md`

## Links

- GitHub: `https://github.com/0xroylee/getsuperpower`
- Docs: `https://github.com/0xroylee/getsuperpower/blob/main/README.md`
- Author Guide:
  `https://github.com/0xroylee/getsuperpower/blob/main/docs/workflow-author-guide.md`
