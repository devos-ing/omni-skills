# Omniskills 登陸頁內容

這是 Omniskills landing page 的 agent-readable 繁體中文 Markdown 鏡像。

Runtime source of truth：`landing/lib/landing-content.ts`。

Component-local page copy 也來自 `landing/components/landing-page.tsx`、
`landing/components/workflow-run-demo.tsx`、`landing/app/workflows/[slug]/page.tsx`。

## Hero

Eyebrow：Orchestration for Codex。

Headline：

```text
One goal. A team of agents. One verified result.
```

Body：把 Codex 變成一個協作團隊。單一 entry skill 會釐清 goal、分派正確的
specialists、收斂成果並完成驗證；Claude、Cursor、opencode、GitHub Copilot 也持續支援。

Primary command preview：

```bash
npx omniskill@latest install startup-team
```

Primary action：Watch a team run。

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
- OpenCode
  - id: `opencode`
- Hermes
  - id: `hermes`
- OpenClaw
  - id: `openclaw`
- GitHub Copilot
  - id: `github-copilot`
  - logo: `/agent-logos/github-copilot.svg`

## 運作方式

Section label：How orchestration works。

1. Install a real team
   - 一個 manifest 同時安裝 coordinator、specialist roles、source-linked playbooks。
2. Give the coordinator one goal
   - Coordinator 釐清 scope、等待 approval，只 route 必要 roles。
3. Verify before feature acceptance
   - Implementation 與任何 bounded rework 都會把 evidence 送回 QA；再由 User Outcome Replay
     檢查 verified result，最後才通過 final human gate。

### Two human gates

You approve the plan and accept the feature. Milestone 會在 implementation 前以及 QA 與
User Outcome Replay 後再次停下；任何 material scope change 都會回到 planning，而不會成為
隱藏假設。

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

Section label：Control tower。

Heading：Watch Codex orchestrate a real team.

Disclosure：`Example run · hardcoded preview`。以下是 real installable manifests
的 deterministic preview，不是 live agents 或 live market data。

Cases：

1. Build a landing page — `$startup-goal`
   - Coordinator activity：Launch selected installed roles。
   - Product、design、engineering planning 平行執行，再依序通過 implementation 與 QA gates。
   - Implement source：`https://github.com/mattpocock/skills/blob/d574778f94cf620fcc8ce741584093bc650a61d3/skills/engineering/implement/SKILL.md`。
2. Research a stock — `$finance-research`
   - Coordinator activity：Prepare selected specialist handoffs。
   - Company、financial、valuation specialists 平行執行，`$risk-analysis` 挑戰 thesis。
3. Research the market — `$market-research`
   - Coordinator activity：Prepare selected specialist handoffs。
   - Macro、rates、market-structure、sector specialists 平行執行，`$risk-analysis` 驗證 regime。

## Omniskills Teams

Section label：Omniskills Teams。

Heading：Pick the team for the goal。

Body：一次安裝 real coordinator 與 specialist roles。Startup Team 負責 product delivery；
Finance Team 研究 public companies；Market Team 建立 sourced regime view。

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

Runtime description：Move one approved startup feature at a time through plan approval,
implementation, conditional rework, QA, User Outcome Replay, and human feature
acceptance.

Coordinator：`$startup-goal` — Controls the Goal Tunnel and Evidence Ledger,
runs selected installed roles as internal subagents with bounded stage packets,
and holds both human approval gates. Prepared, not executed is the fallback when
the host launch capability or role profile is unavailable; public CLI dispatch
stays disabled.

Startup Team 一次只推進一個功能里程碑；證據帳本區分 Verified、Inferred、Assumed，
QA 完成後再執行使用者結果重演，最後由 human 決定是否接受功能。

Members：

- CEO — Company direction and tradeoffs
- CTO — Architecture and technical risk
- Product Manager — Discovery, PRDs, and issue slicing
- Web Design — Interface direction and motion quality
- Engineering Manager — Delivery sequencing and quality gates
- Founding Engineer — Implementation framing and handoff
- QA Lead — Acceptance checks and release risk

Actions：`View team` 開啟 `/workflows/startup-team`；`View team source` 開啟
`https://github.com/devos-ing/omni-skills/tree/main/examples/teams/startup-team`。

Skills：`startup-goal`、`ceo`、`cto`、`product-manager`、`web-design`、`engineering-manager`、`founding-engineer`、`qa-lead`、`superpowers:brainstorming`、`mattpocock:implement`、`setup-model-routing`。

Ordered milestone path：Prepare -> `startup-goal`；Plan -> `startup-goal`；Plan approval -> `startup-goal`；Implement -> `mattpocock:implement`；Rework if needed -> `mattpocock:implement`；Verify -> `qa-lead`；User Outcome Replay -> `startup-goal`；Feature acceptance -> `startup-goal`。

Prepare -> Plan -> Plan approval -> Implement -> Rework if needed -> Verify -> User Outcome Replay -> Feature acceptance

Distribution and safety：Startup Team 包含 checked-in schema `0.2` lock、使用
exact-commit external locators，且所有宣告的 members 都從 same checkout
解析。Managed refresh 必須能從 existing paths 的 records 證明 ownership；
mixed ownership 會 fail closed。Finance Team 與 Market Team 仍是無 lock 的
local previews。

### Finance Team（local preview）

- slug: `finance-team`
- entry skill: `$finance-research`
- source: `https://github.com/devos-ing/omni-skills/tree/main/examples/teams/finance-team`
- repository-local install:

```bash
bun run dev -- install examples/teams/finance-team
```

Coordinator：`$finance-research`。Members：`$company-analysis`、
`$financial-analysis`、`$valuation-analysis`、shared `$risk-analysis`。
這個 alias 尚未透過 `omniskill@latest` 發布。Coordinator 會準備 manual specialist handoff、
回傳 `Prepared, not executed`，且只組合已完成的 outputs。使用 host browsing 與 public
sources，不需要 market-data API，也不提供個人化投資建議。

### Market Team（local preview）

- slug: `market-team`
- entry skill: `$market-research`
- source: `https://github.com/devos-ing/omni-skills/tree/main/examples/teams/market-team`
- repository-local install:

```bash
bun run dev -- install examples/teams/market-team
```

Coordinator：`$market-research`。Members：`$macro-analysis`、`$rates-analysis`、
`$market-structure`、`$sector-analysis`、shared `$risk-analysis`。
這個 alias 尚未透過 `omniskill@latest` 發布。Coordinator 會準備 manual specialist handoff、
回傳 `Prepared, not executed`，且只組合已完成的 outputs。使用 host browsing 與 public
sources，不需要 market-data API，也不提供個人化投資建議。

## Skill Hub

Heading：Explore the Skill Hub。

Body：瀏覽可獨立安裝的 workflows，或檢視它們組合的 skills。

Tabs：

- Workflows
  - Search placeholder：Search workflows, entry skills, or tags...
  - Results 不包含 Startup、Finance、Market teams，因為它們已在上方 featured section 顯示。
  - 每個 result 透過 `View workflow` 開啟 workflow detail route。
  - Empty state：沒有 workflow 符合目前 query；`Clear search` 會重設 query。
- Skills
  - Search placeholder：Search skills, providers, or packages...
  - 每個 canonical skill 只顯示一次，並列出 provider 與所有使用它的 packages。
  - `View skill source` 是唯一 skill action，會開啟 canonical source。
  - 不顯示或暗示 standalone skill install command。
  - Empty state：沒有 skill 符合目前 query；`Clear search` 會重設 query。

Query 會在 Workflows 與 Skills 之間保留。Canonical source identity 會去重
`implement` 與 `mattpocock:implement` 等 aliases，同時保留 package relationships。

### Workflows

以下是可獨立安裝的 workflow catalog；featured teams 不會在此重複。

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

Description：Founder-level strategy，處理 direction、hard tradeoffs、fundraising/customer framing、company decisions。

Skills：`ceo`、`mattpocock:wayfinder`、`mattpocock:grill-with-docs`。

Ordered skill path：Brief -> `ceo`；Decision Map -> `mattpocock:wayfinder`；Grill -> `mattpocock:grill-with-docs`。

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

Description：Technical leadership，處理 architecture、domain model、platform direction、engineering risk。

Skills：`cto`、`mattpocock:codebase-design`、`mattpocock:domain-modeling`、`mattpocock:diagnosing-bugs`、`mattpocock:code-review`。

Ordered skill path：Brief -> `cto`；Domain -> `mattpocock:domain-modeling`；Architecture -> `mattpocock:codebase-design`；Risk -> `mattpocock:diagnosing-bugs`；Review -> `mattpocock:code-review`。

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

Description：Product discovery、PRDs、acceptance criteria、roadmap tradeoffs、issue slicing。

Skills：`product-manager`、`superpowers:brainstorming`、`mattpocock:to-spec`、`mattpocock:to-tickets`、`superpowers:writing-plans`。

Ordered skill path：Brief -> `product-manager`；Brainstorm -> `superpowers:brainstorming`；PRD -> `mattpocock:to-spec`；Issues -> `mattpocock:to-tickets`；Plan -> `superpowers:writing-plans`。

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

Description：Delivery sequencing、execution risk、quality gates、blocker triage、engineering process。

Skills：`engineering-manager`、`superpowers:writing-plans`、`mattpocock:tdd`、`mattpocock:diagnosing-bugs`、`mattpocock:code-review`。

Ordered skill path：Brief -> `engineering-manager`；Plan -> `superpowers:writing-plans`；Quality -> `mattpocock:tdd`；Debug -> `mattpocock:diagnosing-bugs`；Review -> `mattpocock:code-review`。

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

Description：為 smallest correct change 產出 read-only implementation frame：定位 seams、tests、
failure evidence、review risk，以及交給獨立 implementer 的 handoff；不修改檔案或執行 implementation commands。

Skills：`founding-engineer`、`mattpocock:tdd`、`mattpocock:diagnosing-bugs`、`mattpocock:code-review`、`superpowers:verification-before-completion`。

Ordered skill path：Brief -> `founding-engineer`；Tests -> `mattpocock:tdd`；Diagnose -> `mattpocock:diagnosing-bugs`；Review -> `mattpocock:code-review`；Checks -> `superpowers:verification-before-completion`。

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

Description：Release-risk lens，處理 acceptance checks、regression focus、reproduction gaps、verification evidence。

Skills：`qa-lead`、`mattpocock:code-review`、`mattpocock:diagnosing-bugs`、`superpowers:verification-before-completion`。

Ordered skill path：Brief -> `qa-lead`；Review -> `mattpocock:code-review`；Debug -> `mattpocock:diagnosing-bugs`；Verify -> `superpowers:verification-before-completion`。

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

Description：把 prompt、model label、reasoning effort 轉成忠實的 1200 × 675 simulated Codex composer PNG。

Skills：`codex-input-preview` — Render one verified Codex composer PNG。

Ordered skill path：Render -> `codex-input-preview` — Fit the prompt, capture the composer, and verify exact PNG dimensions.

Example output：

- image：`/examples/codex-input-preview.png`
- alt：Simulated Codex input showing “Help me announce that I’m joining the Codex team!” with GPT-5.6 and high effort.
- invocation：`$codex-input-preview Draw “Help me announce that I’m joining the Codex team!” using GPT-5.6 with high effort.`
- disclosure：Simulated Codex composer preview — not a live Codex session.

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

Description：一個 one-shot JTS meme workflow，用於 football-finisher caption、parody post concept、original Haaland profile icon asset。

Skills：`haaland`。

Ordered skill path：One Shot -> `haaland`。

## Common Commands

Section label：Common commands。

Heading：Get up and running fast。

Body：可透過 alias、public git URL 或 local path 安裝。CLI 會 validate workflow manifest、從 workflow
metadata bootstrap missing external skills，並預設把 installed Omniskills workflows 記錄在
`~/.omniskills/workflows/`。Loop-enabled workflows 使用 `omniskill loop` 管理 resumable、action-only state。

```bash
npx omniskill@latest install startup-team
npx omniskill@latest deps startup-team
npx omniskill@latest setup-model-routing
npx omniskill@latest lock examples/teams/startup-team
npx omniskill@latest loop status grilled-product-dev --latest --json
npx omniskill@latest init my-workflow
npx omniskill@latest validate my-workflow
npx omniskill@latest list
npx omniskill@latest remove startup-team
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
npx omniskill@latest init my-workflow
```

Author guide：
`https://github.com/devos-ing/omni-skills/blob/main/docs/workflow-author-guide.md`

## Links

- GitHub: `https://github.com/devos-ing/omni-skills`
- Docs: `https://github.com/devos-ing/omni-skills/blob/main/README.md`
- Author Guide:
  `https://github.com/devos-ing/omni-skills/blob/main/docs/workflow-author-guide.md`
