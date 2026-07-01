<img src="/assets/ponyrace.png" alt="GetSuperpower" width="640" />

# GetSuperpower

GetSuperpower installs reusable AI-agent workflows.

A **GetSuperpower** is a workflow bundle made from several skills. It can install the skills a project needs, record the workflow under `.ponyrace/`, and give users one entry skill to call when the bundle provides one.

## Quick Start

Install the default product-development GetSuperpower:

```bash
npx ponyrace getsuperpower install product-dev
```

See what it will install:

```bash
npx ponyrace getsuperpower deps product-dev
```

List installed GetSuperpowers:

```bash
npx ponyrace getsuperpower list
```

Restart Codex, Claude, Cursor, or GitHub Copilot after installing skills so the agent reloads them.

## Try A Callable Workflow

Some GetSuperpowers include an entry skill. That is the one skill a user calls to run the whole skill tree.

From a cloned repo, the OpenSpec + Superpowers example installs `$openspec-superpowers`:

```bash
npx ponyrace getsuperpower install examples/workflows/openspec-superpowers
```

Then restart your agent app and invoke:

```text
$openspec-superpowers implement this OpenSpec change
```

The entry skill tells the agent to use the required sub-skills in order. The CLI handles installation, validation, and local workflow records.

## Create Your Own

Create a new GetSuperpower:

```bash
npx ponyrace getsuperpower init release-review
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
npx ponyrace skills install creating-bundle-skills
```

Then ask your agent to use:

```text
$creating-bundle-skills create a GetSuperpower for release review
```

Validate before sharing:

```bash
npx ponyrace getsuperpower validate release-review
npx ponyrace getsuperpower deps release-review
```

The full guide is in [`docs/workflow-author-guide.md`](docs/workflow-author-guide.md).

## Vocabulary

| Term | Meaning |
| --- | --- |
| GetSuperpower / 工作流包 | The folder users create, share, and install. |
| Skill Tree / 技能树 | The ordered workflow inside a GetSuperpower. |
| Entry Skill | The callable skill, usually `skills/<name>/SKILL.md`. |
| Sub-skill | A required skill used by one workflow phase. |
| Step | One node in the skill tree. |

An entry skill is instruction-level orchestration. It tells the agent which skills to load and in what order. Fully automatic shell-driven step execution is still deferred while the contract settles.

## Examples

| Example | Use it for | Notes |
| --- | --- | --- |
| `product-dev` | Product changes with brainstorm, planning, and evidence. | Bundled default. |
| `examples/workflows/openspec-superpowers` | OpenSpec proposal -> Superpowers planning/TDD -> archive. | Includes `$openspec-superpowers`. |
| `examples/workflows/real-engineering` | RTK, `pony-trail`, Superpowers, and Matt Pocock skills together. | Fetches Matt Pocock skills if missing. |
| `examples/workflows/release-review` | Small release-risk review workflow. | Good starter example. |

GetSuperpower install automatically uses the Skills CLI to fetch missing `mattpocock:*` dependencies. If that automatic bootstrap fails, run the same package install through the CLI and retry:

```bash
npx ponyrace skills install mattpocock/skills
```

## Common Commands

| Command | Purpose |
| --- | --- |
| `npx ponyrace getsuperpower install product-dev` | Install the default GetSuperpower. |
| `npx ponyrace getsuperpower deps <source>` | Show required skills before install. |
| `npx ponyrace getsuperpower list` | Show installed GetSuperpowers. |
| `npx ponyrace getsuperpower init <name>` | Create a GetSuperpower scaffold. |
| `npx ponyrace getsuperpower validate <path>` | Validate a workflow manifest. |
| `npx ponyrace skills install mattpocock/skills` | Install an external skills package through the Skills CLI. |
| `npx ponyrace skills install creating-bundle-skills` | Install the GetSuperpower authoring skill. |
| `npx ponyrace skills install pony-trail` | Install only the file-change history skill. |
| `npx ponyrace history` | Show local snapshot history. |
| `npx ponyrace history --details` | Show detailed snapshot metadata. |
| `npx ponyrace revert <snapshot-id> --dry-run` | Preview restoring files from a snapshot. |

The older `bundle` and `workflow` commands still work as compatibility aliases.

## Local Files

The CLI writes local project state under `.ponyrace/`:

```text
.ponyrace/
  workflows/
  snapshots.jsonl
  sessions/
```

Keep `.ponyrace/` out of git unless you intentionally want to share project policy or generated reports.

## Local Development

```bash
bun install
bun run build
bun test
bun run check
```

## Migration Note

The package and CLI binary are still named `ponyrace` for now. The product
surface is GetSuperpower-only.
