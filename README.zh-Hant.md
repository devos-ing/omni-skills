# GetSuperpower

[English](README.md)

本文件為繁體中文版本。

GetSuperpower 會把完整的 AI agent 工作流程封裝成一個可呼叫的 skill。

**GetSuperpower** 是一個一體化的工作流程 skill。安裝一次、呼叫一個 entry
skill，agent 就會依序執行所有必要的 sub-skills。工作流程可以規劃 spec、腦力激盪設計、撰寫 implementation plan、用
TDD 建置，並在完成後封存結果，而不需要使用者逐一呼叫每個 skill。

<img src="/assets/getsupwerpower.jpg" alt="GetSuperpower" width="640" />

## 快速開始

透過 alias 安裝一個 workflow example：

```bash
npx getsuperpower@latest install openspec-superpowers
```

這個 alias 會對應到已提交的 workflow path：

```bash
npx getsuperpower@latest install 'https://github.com/0xroylee/getsuperpower.git#examples/workflows/openspec-superpowers'
```

用同樣方式安裝其他 workflow examples：

```bash
npx getsuperpower@latest install release-review
npx getsuperpower@latest install real-engineering
npx getsuperpower@latest install development-design-delivery
```

列出已安裝的 GetSuperpowers：

```bash
npx getsuperpower@latest list
```

支援的 agents：Claude、Codex、Cursor、opencode/OpenCodex、GitHub Copilot。CLI aliases 包含
`opencode`、`opencodex`、`copilot`、`github-copilot`。

安裝 skills 後，重新啟動你的 agent，讓它重新載入 skills。

## 運作方式

<img src="assets/diagrams/getsuperpower-how-it-works.svg" alt="GetSuperpower workflow diagram" width="720" />

`workflow.json` 會安裝 skill tree。entry skill 是使用者呼叫的唯一 command。sub-skills 則是 agent 在背後依序執行的 steps。

### 安裝與執行流程

<img src="assets/diagrams/getsuperpower-install-sequence.svg" alt="GetSuperpower install and run sequence diagram" width="920" />

## 建立自己的 GetSuperpower

如果你想 author 並分享 workflow bundle，請先閱讀 [Create Your Own Workflow guide](docs/workflow-author-guide.md)。

建立新的 GetSuperpower：

```bash
npx getsuperpower@latest init release-review
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
npx getsuperpower@latest skills install creating-bundle-skills
```

然後要求你的 agent 使用：

```text
$creating-bundle-skills create a GetSuperpower for release review
```

這個 skill 會協助你選擇聚焦的 workflow、草擬 entry skill、對齊 `workflow.json`，並在分享之前驗證 bundle。

分享前請先驗證：

```bash
npx getsuperpower@latest validate ./release-review
npx getsuperpower@latest deps ./release-review
```

完整指南在 [`docs/workflow-author-guide.md`](docs/workflow-author-guide.md)。

## 範例

| Example | 適合用途 | Notes |
| --- | --- | --- |
| `examples/workflows/openspec-superpowers` | OpenSpec Delivery：proposal -> design -> plan -> TDD -> verification -> archive。 | 包含 `$openspec-delivery`。 |
| `examples/workflows/development-design-delivery` | Product-minded engineering：shape -> interface design -> plan -> TDD -> review -> evidence。 | 包含 `$development-design-delivery`。 |
| `examples/workflows/real-engineering` | 將 RTK、`pony-trail`、Superpowers、Matt Pocock skills 組合使用。 | 若缺少 Matt Pocock skills，會自動抓取。 |
| `examples/workflows/release-review` | 小型 release-risk review workflow。 | 適合當 starter example。 |

GetSuperpower install 會自動使用每個 workflow skill 的 `repo` metadata，透過 Skills CLI 抓取缺少的 external skills。例如：
`{ "source": "superpowers:brainstorming", "repo": "obra/superpowers" }`
會在 `source` 保留原始 skill name，並用
`npx skills add obra/superpowers --skill brainstorming` 安裝它。

如果 automatic bootstrap 失敗，請透過 CLI 執行同一個 package install，然後重試：

```bash
npx getsuperpower@latest skills install mattpocock/skills
```

## Commands

GetSuperpower CLI 支援 workflow install、inspection、authoring、skill management。以下是常用 commands：

- `npx getsuperpower@latest install <alias-or-path-or-git-url>`
- `npx getsuperpower@latest deps <source>`
- `npx getsuperpower@latest list`
- `npx getsuperpower@latest init <name>`
- `npx getsuperpower@latest validate <source>`
- `npx getsuperpower@latest skills install`
- `npx getsuperpower@latest skills install mattpocock/skills`
- `npx getsuperpower@latest skills install creating-bundle-skills`

執行 `npx getsuperpower@latest --help` 或 `npx getsuperpower@latest <command> --help` 查看詳細用法。

較舊的 `bundle` 和 `workflow` commands 仍可作為 compatibility aliases 使用。

## 安裝後的檔案

預設情況下，CLI 會將 installed workflow records 寫入 home directory：

```text
~/
.getsuperpower/
  workflows/
```

當你明確需要 project-local workflow record 時，請使用 `--dir <project>`。

GetSuperpower 聚焦在 bundle skills 時，Pony Trail history、revert、prehook features 暫停。

除非你明確想分享 installed workflow records，否則請不要把 project-local `.getsuperpower/` folders 加進 git。

## Local Development

```bash
bun install
bun run build
bun test
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

## Compatibility

Package 和 CLI binary 的名稱都是 `getsuperpower`。
