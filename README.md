<img src="/assets/getsupwerpower.jpg" alt="GetSuperpower" width="640" />

# GetSuperpower

GetSuperpower packages a whole AI-agent workflow as one callable skill.

A **GetSuperpower** is an all-in-one workflow skill. Install it once, call one
entry skill, and the agent follows the required sub-skills in order. A workflow
can plan a spec, brainstorm design, write an implementation plan, build with
TDD, and archive the result without the user calling each skill separately.

## Quick Start

Install a workflow example by alias:

```bash
npx getsuperpower@latest install openspec-superpowers
```

The alias is shorthand for the checked-in workflow path:

```bash
npx getsuperpower@latest install 'https://github.com/0xroylee/getsuperpower.git#examples/workflows/openspec-superpowers'
```

Install other workflow examples the same way:

```bash
npx getsuperpower@latest install release-review
npx getsuperpower@latest install real-engineering
npx getsuperpower@latest install development-design-delivery
```

List installed GetSuperpowers:

```bash
npx getsuperpower@latest list
```

Supported agents: Claude, Codex, Cursor, opencode/OpenCodex, and GitHub Copilot. CLI aliases include `opencode`, `opencodex`, `copilot`, and `github-copilot`.

Restart your agent after installing skills so it reloads them.

## How It Works

<img src="assets/diagrams/getsuperpower-how-it-works.svg" alt="GetSuperpower workflow diagram" width="720" />

`workflow.json` installs the skill tree. The entry skill is the one command users invoke. Sub-skills are the steps the agent follows behind that call.

### Install And Run Sequence

<img src="assets/diagrams/getsuperpower-install-sequence.svg" alt="GetSuperpower install and run sequence diagram" width="920" />

## Create Your Own

Start with the [Create Your Own Workflow guide](docs/workflow-author-guide.md) if you want to author and share a workflow bundle.

Create a new GetSuperpower:

```bash
npx getsuperpower@latest init release-review
```

This creates:

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

`skills/release-review/SKILL.md` is the entry skill. Edit it when you want users to call one skill that coordinates many sub-skills.

Install the authoring helper if you want an agent to help design bundle skills:

```bash
npx getsuperpower@latest skills install creating-bundle-skills
```

Then ask your agent to use:

```text
$creating-bundle-skills create a GetSuperpower for release review
```

That skill should help you choose a focused workflow, draft the entry skill,
align `workflow.json`, and validate the bundle before you share it.

Validate before sharing:

```bash
npx getsuperpower@latest validate ./release-review
npx getsuperpower@latest deps ./release-review
```

The full guide is in [`docs/workflow-author-guide.md`](docs/workflow-author-guide.md).

## Examples

| Example | Use it for | Notes |
| --- | --- | --- |
| `examples/workflows/openspec-superpowers` | OpenSpec Delivery: proposal -> design -> plan -> TDD -> verification -> archive. | Includes `$openspec-delivery`. |
| `examples/workflows/development-design-delivery` | Product-minded engineering: shape -> interface design -> plan -> TDD -> review -> evidence. | Includes `$development-design-delivery`. |
| `examples/workflows/real-engineering` | RTK, `pony-trail`, Superpowers, and Matt Pocock skills together. | Fetches Matt Pocock skills if missing. |
| `examples/workflows/release-review` | Small release-risk review workflow. | Good starter example. |

GetSuperpower install automatically uses each workflow skill's `repo` metadata
to fetch missing external skills through the Skills CLI. For example,
`{ "source": "superpowers:brainstorming", "repo": "obra/superpowers" }`
keeps the original skill name in `source` and installs it with
`npx skills add obra/superpowers --skill brainstorming`.

If automatic bootstrap fails, run the same package install through the CLI and
retry:

```bash
npx getsuperpower@latest skills install mattpocock/skills
```

## Commands

The GetSuperpower CLI supports workflow install, inspection, authoring, and skill management. Below are some of the most used commands:

- `npx getsuperpower@latest install <alias-or-path-or-git-url>`
- `npx getsuperpower@latest deps <source>`
- `npx getsuperpower@latest list`
- `npx getsuperpower@latest init <name>`
- `npx getsuperpower@latest validate <source>`
- `npx getsuperpower@latest skills install`
- `npx getsuperpower@latest skills install mattpocock/skills`
- `npx getsuperpower@latest skills install creating-bundle-skills`

Run `npx getsuperpower@latest --help` or `npx getsuperpower@latest <command> --help` for detailed usage.

The older `bundle` and `workflow` commands still work as compatibility aliases.

## Local Files

The CLI writes installed workflow records under `.getsuperpower/`:

```text
.getsuperpower/
  workflows/
```

Pony Trail history, revert, and prehook features are paused while GetSuperpower focuses on bundle skills.

Keep `.getsuperpower/` out of git unless you intentionally want to share installed workflow records.

## Local Development

```bash
bun install
bun run build
bun test
bun run check
bun scripts/smoke-public-git-install.ts
```

Landing app:

```bash
cd landing
bun install
bun run dev
bun run build
```

## Compatibility

The package and CLI binary are named `getsuperpower`.
