# Omniskills

[English](README.md)

本文件為繁體中文版本。

Power your ability.

Omniskills 是給 AI agents 使用的 many-skill bank：安裝一個 workflow skill
tree，帶著目標呼叫一個 entry skill，就能把適合當前問題的 roles、playbooks、verification
habits 交給你的 agent。核心很簡單：3x your ability，而不用手動切換每個 specialist skill。

Startup Team 會把一個已核准的 startup goal 拆成一次一個、可檢查的功能里程碑；每個
plan 都在 implementation 前審核，結果通過 verification 後，再以使用者結果重演重建原始的
expectations、needs、wishes 與 journey，最後才進入 feature acceptance。證據帳本會清楚區分
Verified、Inferred、Assumed。在支援的 host 上，系統會以內部 subagents 執行選定的
startup-team 角色，且每個階段只傳遞有限的資料包。流程仍會在計畫核准及功能驗收時
暫停；只有當內部啟動能力或已安裝的角色 profile 不可用時，才回退為
`Prepared, not executed`。公開 CLI dispatch 仍維持停用。

`Prepare -> Plan -> Plan approval -> Implement -> Rework if needed -> Verify -> User Outcome Replay -> Feature acceptance`


## 快速開始

安裝完整的 Startup Team：

```bash
npx omniskill@latest install startup-team
```

然後請你的 agent 帶著目標執行 `$startup-goal` coordinator：

```text
$startup-goal I have an AI bookkeeping idea; help me choose the wedge and ship a v1 in two weeks
```

這個 alias 會指向 repo 內已提交的 workflow bundle：

```bash
npx omniskill@latest install 'https://github.com/devos-ing/omni-skills.git#examples/teams/startup-team'
```

### Finance Team（local preview）

`finance-team` 尚未透過 `omniskill@latest` 發布。從這個 repository 預覽安裝後，
呼叫 `$finance-research`，由 coordinator 準備 company、financial、valuation、risk
specialists 的 handoff，並在收到已完成的 outputs 後產出有來源依據的 public-company brief。

```bash
bun run dev -- install examples/teams/finance-team
```

### Market Team（local preview）

`market-team` 尚未透過 `omniskill@latest` 發布。從這個 repository 預覽安裝後，
呼叫 `$market-research`，由 coordinator 準備 macro、rates、market-structure、sector、risk
specialists 的 handoff，並在收到已完成的 outputs 後產出有來源依據的 market-regime brief。

```bash
bun run dev -- install examples/teams/market-team
```

兩個 teams 都使用 host-provided browsing 與 public sources，不需要 market-data API，
也不提供個人化投資建議。

這些 previews 不會自動啟動 specialists。Coordinator 只會準備 manual specialist
handoffs；當 host launch capability 或 role profile 無法使用時，會回傳
`Prepared, not executed`，並且只組合已完成的 outputs。

如果你只需要單一 specialist workflow，也可以安裝個別 startup roles：

```bash
npx omniskill@latest install ceo
npx omniskill@latest install cto
npx omniskill@latest install product-manager
npx omniskill@latest install web-design
npx omniskill@latest install engineering-manager
npx omniskill@latest install founding-engineer
npx omniskill@latest install qa-lead
```

安裝 skills 後，請重新啟動你的 agent，讓它重新載入新的 entry skills。

### 安裝事實

Startup Team 已包含 checked-in schema `0.2` lock。External GitHub locators
使用 exact commits，且所有宣告的 team members 都會從 root team 的 same
checkout 解析。Lock 會 fingerprint 已宣告的 dependency graph 與 locators；
它不會獨立 snapshot 已下載的 remote contents。

重新安裝時，Omniskills 只會在 recorded artifact paths 能證明 ownership 時
refresh existing target。若 target 存在 mixed ownership，例如 managed primary
搭配 user-owned mirror，系統會跳過該 target，不會取代 user-owned copy。
Finance Team 與 Market Team 仍是無 lock 的 local previews，直到完整 graph
通過 publication smoke。

## Workflow Registry

使用 registry view 挑選一個 Omniskills workflow、檢視它的 role workflow，並複製 install command。

<img src="assets/omniskill-startup-role-registry.png" alt="Omniskills startup role workflow registry" width="920" />

## Startup Role Workflows

| Omniskills workflow | Entry skill | 用途 |
| --- | --- | --- |
| Startup Team | `$startup-goal` | 一次推進一個有證據支持的功能里程碑，經過 plan approval、implementation、conditional rework、verification、使用者結果重演與 feature acceptance。 |
| Finance Team（local preview） | `$finance-research` | 準備 company、financial、valuation、risk specialists 的 manual handoff，收到已完成 outputs 後產出有來源依據的 public-company brief。 |
| Market Team（local preview） | `$market-research` | 準備 macro、rates、market-structure、sector、risk specialists 的 manual handoff，收到已完成 outputs 後產出有來源依據的 market-regime brief。 |
| CEO | `$ceo` | Direction、hard tradeoffs、fundraising/customer framing、company decisions。 |
| CTO | `$cto` | Architecture、domain model、platform direction、engineering risk。 |
| Product Manager | `$product-manager` | Product discovery、PRDs、acceptance criteria、roadmap tradeoffs、issue slicing。 |
| Web Design | `$web-design` | 可實作的 interface direction、responsive interaction states，以及嚴格的 animation review。 |
| Engineering Manager | `$engineering-manager` | Delivery sequencing、execution risk、quality gates、blocker triage、engineering process。 |
| Founding Engineer | `$founding-engineer` | Read-only implementation frame：定位 seams、tests、risk 與 handoff；不修改檔案。 |
| QA Lead | `$qa-lead` | Release-risk review、acceptance checks、regression focus、reproduction gaps、verification evidence。 |

每個 workflow 仍然只是你可以檢查的檔案：`workflow.json`、選用的
`workflow.lock.json`、README、local skills。它的力量來自於一次安裝 skill tree，然後呼叫知道該使用哪些
companion skills 的 entry skill。

### 我應該使用哪個 workflow？

| 如果你需要... | 使用 |
| --- | --- |
| 一個經過 brainstorm、plan approval、implementation、QA 與 feature acceptance 的完整 milestone | `startup-team` |
| Discovery、PRD、acceptance criteria 或 issue slicing | `product-manager` |
| 把模糊的 product-development goal 推進成 approved plan 的可恢復 loop | `grilled-product-dev` |
| 示範 product-minded engineering composition 與 verification | `development-design-delivery` |
| 示範如何組合 RTK、Superpowers 與 Matt Pocock skills | `real-engineering` |

`founding-engineer` 只產出 read-only implementation frame；它不會實作工作。

## Goal Loops

有些 Omniskills workflows 也提供 loop runner，適合需要持續推進直到完成的 goals。loop 是可恢復的 workflow state：
`loop start` 建立 run，`loop status` 顯示狀態，`loop advance` 回傳下一個 suggested action。

runtime 是 action-only。它會記錄狀態並回傳下一個 suggested action；它不會默默替 agent 執行 tools 或 shell commands。
預設的 loop run state 會存放在 `~/.omniskills/runs/<workflow-name>/<run-id>/`。

試試 loop-capable product-development workflow：

```bash
npx omniskill@latest loop start grilled-product-dev --json
npx omniskill@latest loop status grilled-product-dev --latest --json
npx omniskill@latest loop advance grilled-product-dev --run <run-id> --json
```

這種形狀適合複雜工作：釐清 goal、推進一個 action、驗證 evidence，然後持續 advance 直到 goal 完成。

## Built-In Workflow Ecosystem

Omniskills workflows 可以組合 local skills、bundled skills、external skill packs：

- Matt Pocock skills：TDD、review、design pressure-testing、domain modeling、PRDs、issue slicing。
- Superpowers skills：brainstorming、planning、execution、verification。
- Emil Kowalski skills：提供 design engineering 與 motion 能力。Canonical identifiers 是
  `emilkowalski:emil-design-eng`、`emilkowalski:animation-vocabulary`、
  `emilkowalski:apple-design`、`emilkowalski:review-animations`，並從
  `https://github.com/emilkowalski/skills/tree/6bf24434f7730ad169077756cf9c7cd7bd675fc6`
  的已稽核 commit 安裝。較舊的 `interface-craft:*` identifiers 僅保留為 compatibility aliases。
- More workflow packs are coming.

`omniskill install` 會使用每個 workflow skill 的 `repo` metadata，透過 Skills CLI 抓取缺少的 external
skills。例如：
`{ "source": "superpowers:brainstorming", "repo": "https://github.com/obra/superpowers/tree/d884ae04edebef577e82ff7c4e143debd0bbec99" }`
會在 `source` 保留原始 skill name，並用
`npx skills add https://github.com/obra/superpowers/tree/d884ae04edebef577e82ff7c4e143debd0bbec99 --skill brainstorming` 安裝它。

如果 automatic bootstrap 失敗，請透過 Omniskills 執行 package install，然後重試：

```bash
npx omniskill@latest skills install mattpocock/skills
```

## Command Reference

```bash
npx omniskill@latest install <alias-or-path-or-git-url>
npx omniskill@latest list
npx omniskill@latest deps <source>
npx omniskill@latest lock <source>
npx omniskill@latest loop <start|status|log|advance|summary> <source>
npx omniskill@latest remove <workflow-name>
npx omniskill@latest onboard
npx omniskill@latest setup-model-routing
npx omniskill@latest init <name>
npx omniskill@latest validate <source>
npx omniskill@latest skills install
npx omniskill@latest skills update
```

執行 `npx omniskill@latest --help` 或
`npx omniskill@latest <command> --help` 查看詳細用法。

較舊的 `bundle` command 保留為 `init`、`validate`、`lock` 的 compatibility alias；
較舊的 `workflow` command 則保留為 `install`、`list`、`remove` 的 compatibility alias。

## 建立自己的 Omniskills workflow

如果你想 author 並分享 workflow bundle，請先閱讀 [Create Your Own Workflow guide](docs/workflow-author-guide.md)。

建立新的 Omniskills workflow：

```bash
npx omniskill@latest init release-review
```

這會建立：

```text
release-review/
  workflow.json
  README.md
  skills/
    release-review/
      SKILL.md
    custom-review/
      SKILL.md
```

`skills/release-review/SKILL.md` 是 entry skill。當你希望使用者呼叫一個 skill 來協調多個 sub-skills 時，請編輯它。

如果你希望 agent 協助設計 bundle skills，可以安裝 authoring helper：

```bash
npx omniskill@latest skills install creating-bundle-skills
```

然後要求你的 agent 使用：

```text
$creating-bundle-skills create an Omniskills workflow for release review
```

分享前請先驗證：

```bash
npx omniskill@latest validate ./release-review
npx omniskill@latest deps ./release-review
```

完整指南在 [`docs/workflow-author-guide.md`](docs/workflow-author-guide.md)。

## Examples

| Example | 適合用途 | Notes |
| --- | --- | --- |
| `examples/teams/startup-team` | 圍繞一個 goal 安裝 realistic startup operating team。 | 包含 `$startup-goal` coordinator，以及 `$ceo`、`$cto`、`$product-manager`、`$web-design`、`$engineering-manager`、`$founding-engineer`、`$qa-lead`。 |
| `examples/workflows/ceo` | Company direction、strategy、tradeoffs、decision mapping。 | Uses Matt Pocock decision and grilling skills. |
| `examples/workflows/cto` | Architecture、domain model、technical risk、review。 | Uses Matt Pocock architecture/review skills. |
| `examples/workflows/product-manager` | Discovery、PRD、issue slicing、product planning。 | Uses Superpowers plus Matt Pocock PRD/issue skills. |
| `examples/workflows/web-design` | Interface direction、responsive interaction states、animation review。 | 使用 canonical Emil Kowalski skill identifiers。 |
| `examples/workflows/engineering-manager` | Delivery sequencing、quality gates、execution risk。 | Uses planning, TDD, diagnosing, and review skills. |
| `examples/workflows/founding-engineer` | Read-only implementation framing、test seams、debugging evidence、review risk。 | Handoff 給獨立 implementer；不修改檔案。 |
| `examples/workflows/qa-lead` | Acceptance checks、regression focus、release verification。 | Uses review, diagnosing, and verification skills. |
| `examples/workflows/grilled-product-dev` | 將 product-development work 形成 approved plan 的 goal loops。 | Provides `loop start`, `loop status`, and `loop advance`. |
| `examples/workflows/openspec-superpowers` | OpenSpec delivery 的 compatibility/demo workflow。 | Kept for one release while the role catalog becomes the primary example set. |
| `examples/workflows/development-design-delivery` | Product-minded engineering 的 compatibility/demo workflow。 | Richer composition example with verification. |
| `examples/workflows/real-engineering` | 組合 RTK、Superpowers、Matt Pocock skills 的 compatibility/demo workflow。 | Fetches external skills if missing. |
| `examples/workflows/release-review` | Release-risk review 的 compatibility/demo workflow。 | Good minimal example. |
| `examples/workflows/haaland` | Curated playful Haaland/JTS meme workflow。 | 使用 bundled profile asset 產生一張 meme。 |

## Installed Files

預設情況下，CLI 會將 installed workflow records 寫入 home directory：

```text
~/.omniskills/workflows/
```

當你明確需要 project-local workflow record 時，請使用 `--dir <project>`。

除非你明確想分享 installed workflow records，否則請不要把 project-local `.omniskills/` folders 加進 git。

## Local Development

```bash
bun install
bun run build
bun test
bun run typecheck
bun run coverage
bun run check
bun scripts/smoke-public-git-install.ts
```

Landing app：

```bash
cd landing
bun install
bun run dev
bun run build
```
