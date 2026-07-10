# Omniskills 登陸頁內容

這是 Omniskills landing page 的 agent-readable 繁體中文 Markdown 鏡像。

Runtime source of truth：`landing/lib/landing-content.ts`。

Component-local page copy 也來自 `landing/components/landing-page.tsx`、
`landing/components/workflow-run-demo.tsx`、`landing/app/workflows/[slug]/page.tsx`。

## Hero

Eyebrow：Works with Claude, Codex, Cursor, opencode, and GitHub Copilot.

Headline：

```text
Power your ability.
Install the workflow.
```

Body：Omniskills 是給 AI agents 使用的 many-skill bank。安裝一個 workflow skill
tree，帶著 goal 呼叫一個 entry skill，讓 agent 取得能 3x your ability 的 roles、playbooks、verification habits。

Primary command preview：

```bash
npx omniskills@latest install startup-goal
```

Primary action：Browse workflows。

## 支援的 Agents

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

## 運作方式

Section label：How it works。

Heading：One entry skill. Many specialist skills.

1. Install a many-skill bank

   workflow manifest 會定義 callable entry skill，以及它需要的每個 local 或 external
   specialist skill。

2. Call one entry skill with a goal

   使用者呼叫單一 skill，例如 `$startup-goal`，workflow 會把 goal route 到正確 roles。

3. Compound specialist judgment

   Strategy、product、architecture、delivery、implementation、QA roles 會保持對齊，讓
   agent 在不用手動 juggling skills 的情況下 3x your ability。Looped workflows 可以透過 CLI
   追蹤 resumable、action-only workflow state。

## Workflow Run Demo

Section label：Try it live。

Heading：Watch the workflow run。

Body：模擬呼叫 `$startup-goal`，並看到每個 role skill 回傳 combined answer 的一部分。

Prompt：

```text
> $startup-goal help me launch this product from idea to shipped v1
```

Demo steps：

1. Route Goal
   - skill: `startup-goal`
2. Strategy
   - skill: `ceo`
3. Product Scope
   - skill: `product-manager`
4. Architecture
   - skill: `cto`
5. Implementation
   - skill: `founding-engineer`
6. QA Review
   - skill: `qa-lead`

Completion copy：Workflow complete - all 6 role steps returned. Startup answer ready.

## Workflow Registry

Section label：Workflow Registry。

Heading：Pick an Omniskills workflow。

Body：瀏覽可安裝的 workflow bundles，然後打開 detail route 查看 role map、skill tree、copyable install command。

Search placeholder：Search workflows, skills, tags...

### Startup Goal

- slug: `startup-goal`
- tag: Goal
- entry skill: `$startup-goal`
- avatar seed: `sha256:e2445fdfee4ef3d0a8aae8333a820a8485338bd1f62674c2596be49dba878f5f`
- accent: `text-violet-300`
- source: `https://github.com/0xroylee/getsuperpower/tree/main/examples/workflows/startup-goal`
- install:

```bash
npx omniskills@latest install startup-goal
```

Description：讓 startup goal 依序經過 core operating roles：CEO、CTO、PM、EM、founding engineer、QA lead。

Skills：`startup-goal`、`ceo`、`cto`、`product-manager`、`engineering-manager`、`founding-engineer`、`qa-lead`、`superpowers:brainstorming`、`superpowers:writing-plans`、`superpowers:verification-before-completion`、`mattpocock:decision-mapping`、`mattpocock:grill-with-docs`、`mattpocock:to-prd`、`mattpocock:to-issues`、`mattpocock:codebase-design`、`mattpocock:domain-modeling`、`mattpocock:tdd`、`mattpocock:diagnosing-bugs`、`mattpocock:review`、`implement`。

Ordered skill path：Route -> `startup-goal`；Strategy -> `ceo`；Product -> `product-manager`；Technology -> `cto`；Delivery -> `engineering-manager`；Implementation -> `founding-engineer`；QA -> `qa-lead`。

### CEO

- slug: `ceo`
- tag: Strategy
- entry skill: `$ceo`
- avatar seed: `sha256:e28e960ca32f944aad4353c9248e43ca7526a5f4451d1293cd79590878f2b25a`
- accent: `text-rose-300`
- source: `https://github.com/0xroylee/getsuperpower/tree/main/examples/workflows/ceo`
- install:

```bash
npx omniskills@latest install ceo
```

Description：Founder-level strategy，處理 direction、hard tradeoffs、fundraising/customer framing、company decisions。

Skills：`ceo`、`mattpocock:decision-mapping`、`mattpocock:grill-with-docs`。

Ordered skill path：Brief -> `ceo`；Decision Map -> `mattpocock:decision-mapping`；Grill -> `mattpocock:grill-with-docs`。

### CTO

- slug: `cto`
- tag: Architecture
- entry skill: `$cto`
- avatar seed: `sha256:644afba52d60f4bbcf9a608c6ead98688650e9fc3f8ed0a63ac0d30ca4931156`
- accent: `text-sky-300`
- source: `https://github.com/0xroylee/getsuperpower/tree/main/examples/workflows/cto`
- install:

```bash
npx omniskills@latest install cto
```

Description：Technical leadership，處理 architecture、domain model、platform direction、engineering risk。

Skills：`cto`、`mattpocock:codebase-design`、`mattpocock:domain-modeling`、`mattpocock:diagnosing-bugs`、`mattpocock:review`。

Ordered skill path：Brief -> `cto`；Domain -> `mattpocock:domain-modeling`；Architecture -> `mattpocock:codebase-design`；Risk -> `mattpocock:diagnosing-bugs`；Review -> `mattpocock:review`。

### Product Manager

- slug: `product-manager`
- tag: Product
- entry skill: `$product-manager`
- avatar seed: `sha256:c0c7094ce1e2d9c614bd9939d9a379f488d809b0316d568017f584263f1eab8f`
- accent: `text-emerald-300`
- source: `https://github.com/0xroylee/getsuperpower/tree/main/examples/workflows/product-manager`
- install:

```bash
npx omniskills@latest install product-manager
```

Description：Product discovery、PRDs、acceptance criteria、roadmap tradeoffs、issue slicing。

Skills：`product-manager`、`superpowers:brainstorming`、`mattpocock:to-prd`、`mattpocock:to-issues`、`superpowers:writing-plans`。

Ordered skill path：Brief -> `product-manager`；Brainstorm -> `superpowers:brainstorming`；PRD -> `mattpocock:to-prd`；Issues -> `mattpocock:to-issues`；Plan -> `superpowers:writing-plans`。

### Engineering Manager

- slug: `engineering-manager`
- tag: Delivery
- entry skill: `$engineering-manager`
- avatar seed: `sha256:70d97c45ac61d3774317681dc7ae318126e14a3d0b19f00183d8227ca0fb1071`
- accent: `text-amber-300`
- source: `https://github.com/0xroylee/getsuperpower/tree/main/examples/workflows/engineering-manager`
- install:

```bash
npx omniskills@latest install engineering-manager
```

Description：Delivery sequencing、execution risk、quality gates、blocker triage、engineering process。

Skills：`engineering-manager`、`superpowers:writing-plans`、`mattpocock:tdd`、`mattpocock:diagnosing-bugs`、`mattpocock:review`。

Ordered skill path：Brief -> `engineering-manager`；Plan -> `superpowers:writing-plans`；Quality -> `mattpocock:tdd`；Debug -> `mattpocock:diagnosing-bugs`；Review -> `mattpocock:review`。

### Founding Engineer

- slug: `founding-engineer`
- tag: Build
- entry skill: `$founding-engineer`
- avatar seed: `sha256:2c1ee7f8710c90004a958f81aa84321fad2efc83d8839fede97689f6ebf1b078`
- accent: `text-fuchsia-300`
- source: `https://github.com/0xroylee/getsuperpower/tree/main/examples/workflows/founding-engineer`
- install:

```bash
npx omniskills@latest install founding-engineer
```

Description：Implementation lane，聚焦 smallest correct change：tests、debugging、review、verification。

Skills：`founding-engineer`、`implement`、`mattpocock:tdd`、`mattpocock:diagnosing-bugs`、`mattpocock:review`、`superpowers:verification-before-completion`。

Ordered skill path：Brief -> `founding-engineer`；Implement -> `implement`；TDD -> `mattpocock:tdd`；Debug -> `mattpocock:diagnosing-bugs`；Review -> `mattpocock:review`；Verify -> `superpowers:verification-before-completion`。

### QA Lead

- slug: `qa-lead`
- tag: Quality
- entry skill: `$qa-lead`
- avatar seed: `sha256:17b5f20fa744bdbc0791717b5705e8be940b7cbdfaf4d5604e9d6a6a19124a53`
- accent: `text-cyan-300`
- source: `https://github.com/0xroylee/getsuperpower/tree/main/examples/workflows/qa-lead`
- install:

```bash
npx omniskills@latest install qa-lead
```

Description：Release-risk lens，處理 acceptance checks、regression focus、reproduction gaps、verification evidence。

Skills：`qa-lead`、`mattpocock:review`、`mattpocock:diagnosing-bugs`、`superpowers:verification-before-completion`。

Ordered skill path：Brief -> `qa-lead`；Review -> `mattpocock:review`；Debug -> `mattpocock:diagnosing-bugs`；Verify -> `superpowers:verification-before-completion`。

### Haaland

- slug: `haaland`
- tag: Meme
- entry skill: `$haaland`
- avatar seed: `sha256:d10bf16eca98054b3a23bbe0aac21ccb00e7f904c5f3b1c3480bb1009c575583`
- accent: `text-lime-300`
- source: `https://github.com/0xroylee/getsuperpower/tree/main/examples/workflows/haaland`
- install:

```bash
npx omniskills@latest install haaland
```

Description：一個 one-shot JTS meme workflow，用於 football-finisher caption、parody post concept、original Haaland profile icon asset。

Skills：`haaland`。

Ordered skill path：One Shot -> `haaland`。

## Common Commands

Section label：Common commands。

Heading：Get up and running fast。

Body：可透過 alias、public git URL 或 local path 安裝。CLI 會 validate workflow manifest、從 workflow
metadata bootstrap missing external skills，並預設把 installed Omniskills workflows 記錄在
`~/.getsuperpower/workflows/`。Loop-enabled workflows 使用 `omniskills loop` 管理 resumable、action-only state。

```bash
npx omniskills@latest install startup-goal
npx omniskills@latest deps startup-goal
npx omniskills@latest lock examples/workflows/startup-goal
npx omniskills@latest loop status grilled-product-dev --latest --json
npx omniskills@latest init my-workflow
npx omniskills@latest validate my-workflow
npx omniskills@latest list
npx omniskills@latest remove startup-goal
```

Then invoke in your agent：

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

Badge：Author your own workflow。

Heading：Package your workflow as an Omniskills workflow。

Body：scaffold a bundle、define the entry skill、在 workflow.json 中列出 sub-skills、validate、share。Authoring guide 會讓 skill tree 保持對齊。

Command：

```bash
npx omniskills@latest init my-workflow
```

Author guide：
`https://github.com/0xroylee/getsuperpower/blob/main/docs/workflow-author-guide.md`

## Links

- GitHub: `https://github.com/0xroylee/getsuperpower`
- Docs: `https://github.com/0xroylee/getsuperpower/blob/main/README.md`
- Author Guide:
  `https://github.com/0xroylee/getsuperpower/blob/main/docs/workflow-author-guide.md`
