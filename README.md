# GetSuperpower

[繁體中文](README.zh-Hant.md)

Power your ability.

GetSuperpower is a many-skill bank for AI agents: install one workflow skill
tree, call one entry skill with a goal, and give your agent the right roles,
playbooks, and verification habits for the problem in front of it. The point is
simple: 3x your ability without manually juggling every specialist skill.

Start with Startup Goal when you want to move a company-building goal through many role workflows instead of manually juggling every skill: CEO, CTO, Product Manager, Engineering Manager, Founding Engineer, and QA Lead.

<img src="/assets/getsupwerpower.jpg" alt="GetSuperpower" width="640" />

## Quick Start

Install the full startup goal workflow:

```bash
npx getsuperpower@latest install startup-goal
```

Then ask your agent to run the entry skill with a goal:

```text
$startup-goal I have an AI bookkeeping idea; help me choose the wedge and ship a v1 in two weeks
```

The alias points to the checked-in workflow bundle:

```bash
npx getsuperpower@latest install 'https://github.com/0xroylee/getsuperpower.git#examples/workflows/startup-goal'
```

Install individual startup roles when you want one specialist workflow:

```bash
npx getsuperpower@latest install ceo
npx getsuperpower@latest install cto
npx getsuperpower@latest install product-manager
npx getsuperpower@latest install engineering-manager
npx getsuperpower@latest install founding-engineer
npx getsuperpower@latest install qa-lead
```

Restart your agent after installing skills so it reloads the new entry skills.

## Workflow Registry

Use the registry view to pick a GetSuperpower, inspect its role workflow, and
copy the install command.

<img src="assets/getsuperpower-startup-role-registry.png" alt="GetSuperpower startup role workflow registry" width="920" />

## Startup Role Workflows

| GetSuperpower | Entry skill | What it helps with |
| --- | --- | --- |
| Startup Goal | `$startup-goal` | Route a company-building goal through strategy, product, architecture, delivery, implementation, and QA role subagents. |
| CEO | `$ceo` | Direction, hard tradeoffs, fundraising/customer framing, and company decisions. |
| CTO | `$cto` | Architecture, domain model, platform direction, and engineering risk. |
| Product Manager | `$product-manager` | Product discovery, PRDs, acceptance criteria, roadmap tradeoffs, and issue slicing. |
| Engineering Manager | `$engineering-manager` | Delivery sequencing, execution risk, quality gates, blocker triage, and engineering process. |
| Founding Engineer | `$founding-engineer` | The smallest correct implementation change: tests, debugging, review, and verification. |
| QA Lead | `$qa-lead` | Release-risk review, acceptance checks, regression focus, reproduction gaps, and verification evidence. |

Each workflow is still just files you can inspect: a `workflow.json`, README,
and local skills. The power comes from installing the skill tree once and then
calling the entry skill that knows which companion skills to use.

## Goal Loops

Some GetSuperpowers also expose a loop runner for goals that should keep moving
until the goal is done. A loop is resumable workflow state: `loop start` creates
a run, `loop status` shows where it is, and `loop advance` returns the next suggested action.

The runtime is action-only. It records state and returns the next suggested action;
it does not silently execute tools or shell commands for the agent.

Try the loop-capable product-development workflow:

```bash
npx getsuperpower@latest loop start grilled-product-dev --json
npx getsuperpower@latest loop status grilled-product-dev --latest --json
npx getsuperpower@latest loop advance grilled-product-dev --run <run-id> --json
```

That shape is useful for complex work: clarify the goal, move one action
forward, verify evidence, and keep advancing until the goal is done.

## Built-In Workflow Ecosystem

GetSuperpower workflows can compose local skills, bundled skills, and external
skill packs:

- Matt Pocock skills for TDD, review, design pressure-testing, domain modeling,
  PRDs, and issue slicing.
- Superpowers skills for brainstorming, planning, execution, and verification.
- Ponytrail evidence for file-change rationale, verification, and rollback
  context in workflows that declare `pony-trail`.
- More workflow packs are coming.

`getsuperpower install` uses each workflow skill's `repo` metadata to fetch
missing external skills through the Skills CLI. For example,
`{ "source": "superpowers:brainstorming", "repo": "obra/superpowers" }`
keeps the original skill name in `source` and installs it with
`npx skills add obra/superpowers --skill brainstorming`.

If automatic bootstrap fails, run the package install through GetSuperpower and
retry:

```bash
npx getsuperpower@latest skills install mattpocock/skills
```

## Command Reference

```bash
npx getsuperpower@latest install <alias-or-path-or-git-url>
npx getsuperpower@latest list
npx getsuperpower@latest deps <source>
npx getsuperpower@latest lock <source>
npx getsuperpower@latest loop <start|status|log|advance|summary> <source>
npx getsuperpower@latest remove <workflow-name>
npx getsuperpower@latest init <name>
npx getsuperpower@latest validate <source>
npx getsuperpower@latest skills install
npx getsuperpower@latest skills update
```

Run `npx getsuperpower@latest --help` or
`npx getsuperpower@latest <command> --help` for detailed usage.

The older `bundle` and `workflow` commands still work as compatibility aliases.

## Create Your Own

Start with the [Create Your Own Workflow guide](docs/workflow-author-guide.md)
if you want to author and share a workflow bundle.

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

`skills/release-review/SKILL.md` is the entry skill. Edit it when you want
users to call one skill that coordinates many sub-skills.

Install the authoring helper if you want an agent to help design bundle skills:

```bash
npx getsuperpower@latest skills install creating-bundle-skills
```

Then ask your agent to use:

```text
$creating-bundle-skills create a GetSuperpower for release review
```

Validate before sharing:

```bash
npx getsuperpower@latest validate ./release-review
npx getsuperpower@latest deps ./release-review
```

The full guide is in [`docs/workflow-author-guide.md`](docs/workflow-author-guide.md).

## Examples

| Example | Use it for | Notes |
| --- | --- | --- |
| `examples/workflows/startup-goal` | Install a realistic startup operating bench around one goal. | Includes `$startup-goal`, `$ceo`, `$cto`, `$product-manager`, `$engineering-manager`, `$founding-engineer`, and `$qa-lead`. |
| `examples/workflows/ceo` | Company direction, strategy, tradeoffs, and decision mapping. | Uses Matt Pocock decision and grilling skills. |
| `examples/workflows/cto` | Architecture, domain model, technical risk, and review. | Uses Matt Pocock architecture/review skills. |
| `examples/workflows/product-manager` | Discovery, PRD, issue slicing, and product planning. | Uses Superpowers plus Matt Pocock PRD/issue skills. |
| `examples/workflows/engineering-manager` | Delivery sequencing, quality gates, and execution risk. | Uses planning, TDD, diagnosing, and review skills. |
| `examples/workflows/founding-engineer` | Implementation, tests, debugging, review, and final verification. | Uses `$implement` as the implementation role. |
| `examples/workflows/qa-lead` | Acceptance checks, regression focus, and release verification. | Uses review, diagnosing, and verification skills. |
| `examples/workflows/grilled-product-dev` | Goal loops for shaping product-development work into an approved plan. | Provides `loop start`, `loop status`, and `loop advance`. |
| `examples/workflows/openspec-superpowers` | Compatibility/demo workflow for OpenSpec delivery. | Kept for one release while the role catalog becomes the primary example set. |
| `examples/workflows/development-design-delivery` | Compatibility/demo workflow for product-minded engineering. | Richer composition example with Ponytrail evidence. |
| `examples/workflows/real-engineering` | Compatibility/demo workflow combining RTK, Ponytrail, Superpowers, and Matt Pocock skills. | Fetches Matt Pocock skills if missing. |
| `examples/workflows/release-review` | Compatibility/demo workflow for release-risk review. | Good minimal example. |

## Installed Files

By default, the CLI writes installed workflow records under your home directory:

```text
~/
.getsuperpower/
  workflows/
```

Use `--dir <project>` when you intentionally want a project-local workflow
record.

Keep project-local `.getsuperpower/` folders out of git unless you
intentionally want to share installed workflow records.

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
