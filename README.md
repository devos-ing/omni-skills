<img src="/assets/getsupwerpower.jpg" alt="GetSuperpower" width="640" />

# GetSuperpower

GetSuperpower packages a whole AI-agent workflow as one callable skill.

A **GetSuperpower** is an all-in-one workflow skill. Install it once, call one
entry skill, and the agent follows the required sub-skills in order. A workflow
can plan a spec, brainstorm design, write an implementation plan, build with
TDD, and archive the result without the user calling each skill separately.

## Quick Start

Install a workflow example from the GetSuperpower git repository:

```bash
npx getsuperpower@latest install 'https://github.com/0xroylee/getsuperpower.git#examples/workflows/openspec-superpowers'
```

Install other workflow examples the same way:

```bash
npx getsuperpower@latest install 'https://github.com/0xroylee/getsuperpower.git#examples/workflows/release-review'
npx getsuperpower@latest clone 'https://github.com/0xroylee/getsuperpower.git#examples/workflows/real-engineering'
npx getsuperpower@latest install 'https://github.com/0xroylee/getsuperpower.git#examples/workflows/development-design-delivery'
```

List installed GetSuperpowers:

```bash
npx getsuperpower@latest list
```

Supported agents: Claude, Codex, opencode, Cursor, and GitHub Copilot.

Restart your agent after installing skills so it reloads them.

## How It Works

<img src="assets/diagrams/getsuperpower-how-it-works.svg" alt="GetSuperpower workflow diagram" width="720" />

`workflow.json` installs the skill tree. The entry skill is the one command users invoke. Sub-skills are the steps the agent follows behind that call.

### Install And Run Sequence

<img src="assets/diagrams/getsuperpower-install-sequence.svg" alt="GetSuperpower install and run sequence diagram" width="920" />

## Try A Callable Workflow

Some GetSuperpowers include an entry skill. That is the one skill a user calls
to run the whole skill tree.

Install the OpenSpec Delivery example from this repo to get `$openspec-delivery`:

```bash
npx getsuperpower@latest install 'https://github.com/0xroylee/getsuperpower.git#examples/workflows/openspec-superpowers'
```

<img src="assets/diagrams/openspec-delivery-workflow.svg" alt="OpenSpec Delivery workflow diagram" width="920" />

Then restart your agent app and invoke:

```text
$openspec-delivery implement this OpenSpec change
```

That one call can propose the spec, run the brainstorming step, write the plan,
build with TDD, verify, and archive according to the workflow. You do not call
the separate skills yourself; the entry skill coordinates them. The CLI handles
installation, validation, and local workflow records.

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
npx getsuperpower@latest validate release-review
npx getsuperpower@latest deps release-review
```

The full guide is in [`docs/workflow-author-guide.md`](docs/workflow-author-guide.md).

## Examples

| Example | Use it for | Notes |
| --- | --- | --- |
| `examples/workflows/openspec-superpowers` | OpenSpec Delivery: proposal -> design -> plan -> TDD -> verification -> archive. | Includes `$openspec-delivery`. |
| `examples/workflows/development-design-delivery` | Product-minded engineering: shape -> interface design -> plan -> TDD -> review -> evidence. | Includes `$development-design-delivery`. |
| `examples/workflows/real-engineering` | RTK, `pony-trail`, Superpowers, and Matt Pocock skills together. | Fetches Matt Pocock skills if missing. |
| `examples/workflows/release-review` | Small release-risk review workflow. | Good starter example. |

GetSuperpower install automatically uses the Skills CLI to fetch missing `mattpocock:*` dependencies. If that automatic bootstrap fails, run the same package install through the CLI and retry:

```bash
npx getsuperpower@latest skills install mattpocock/skills
```

## Common Commands

| Command | Purpose |
| --- | --- |
| `npx getsuperpower@latest install <path-or-git-url>` | Install a GetSuperpower from a local path or public git source. |
| `npx getsuperpower@latest clone <path-or-git-url>` | Same as install; deploy a GetSuperpower from a local path or public git source. |
| `npx getsuperpower@latest install 'https://github.com/0xroylee/getsuperpower.git#examples/workflows/release-review'` | Install a GetSuperpower from a public git repo. |
| `npx getsuperpower@latest deps <source>` | Show required skills before install or clone. |
| `npx getsuperpower@latest list` | Show installed GetSuperpowers. |
| `npx getsuperpower@latest init <name>` | Create a GetSuperpower scaffold. |
| `npx getsuperpower@latest validate <path>` | Validate a workflow manifest. |
| `npx getsuperpower@latest skills install` | Install the GetSuperpower authoring skill. |
| `npx getsuperpower@latest skills install mattpocock/skills` | Install an external skills package through the Skills CLI. |
| `npx getsuperpower@latest skills install creating-bundle-skills` | Install the GetSuperpower authoring skill. |

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
