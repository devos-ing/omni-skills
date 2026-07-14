# Omniskills

[繁體中文](README.zh-Hant.md)

Power your ability.

Omniskills is a many-skill bank for AI agents: install one workflow skill
tree, call one entry skill with a goal, and give your agent the right roles,
playbooks, and verification habits for the problem in front of it. The point is
simple: 3x your ability without manually juggling every specialist skill.

Start with Startup Team when you want to move a company-building goal through a coordinated role bench instead of manually juggling every skill: CEO, CTO, Product Manager, Web Design, Engineering Manager, Founding Engineer, and QA Lead.

## Quick Start

Install the full Startup Team:

```bash
npx omniskill@latest install startup-team
```

Then ask your agent to run its `$startup-goal` coordinator with a goal:

```text
$startup-goal I have an AI bookkeeping idea; help me choose the wedge and ship a v1 in two weeks
```

The alias points to the checked-in workflow bundle:

```bash
npx omniskill@latest install 'https://github.com/devos-ing/omni-skills.git#examples/teams/startup-team'
```

Install individual startup roles when you want one specialist workflow:

```bash
npx omniskill@latest install ceo
npx omniskill@latest install cto
npx omniskill@latest install product-manager
npx omniskill@latest install web-design
npx omniskill@latest install engineering-manager
npx omniskill@latest install founding-engineer
npx omniskill@latest install qa-lead
```

Restart your agent after installing skills so it reloads the new entry skills.

## Workflow Registry

Use the registry view to pick an Omniskills workflow, inspect its role workflow, and
copy the install command.

<img src="assets/omniskill-startup-role-registry.png" alt="Omniskills startup role workflow registry" width="920" />

## Startup Role Workflows

| Omniskills workflow | Entry skill | What it helps with |
| --- | --- | --- |
| Startup Team | `$startup-goal` | Coordinate a company-building goal across strategy, product, interface design, architecture, delivery, implementation, and QA role subagents. |
| CEO | `$ceo` | Direction, hard tradeoffs, fundraising/customer framing, and company decisions. |
| CTO | `$cto` | Architecture, domain model, platform direction, and engineering risk. |
| Product Manager | `$product-manager` | Product discovery, PRDs, acceptance criteria, roadmap tradeoffs, and issue slicing. |
| Web Design | `$web-design` | Implementable interface direction, responsive interaction states, and rigorous animation review. |
| Engineering Manager | `$engineering-manager` | Delivery sequencing, execution risk, quality gates, blocker triage, and engineering process. |
| Founding Engineer | `$founding-engineer` | The smallest correct implementation change: tests, debugging, review, and verification. |
| QA Lead | `$qa-lead` | Release-risk review, acceptance checks, regression focus, reproduction gaps, and verification evidence. |

Each workflow is still just files you can inspect: a `workflow.json`, optional
`workflow.lock.json`, README, and local skills. The power comes from installing
the skill tree once and then calling the entry skill that knows which companion
skills to use.

## Goal Loops

Some Omniskills workflows also expose a loop runner for goals that should keep moving
until the goal is done. A loop is resumable workflow state: `loop start` creates
a run, `loop status` shows where it is, and `loop advance` returns the next suggested action.

The runtime is action-only. It records state and returns the next suggested action;
it does not silently execute tools or shell commands for the agent.
Loop run state is stored under `~/.omniskills/runs/<workflow-name>/<run-id>/`
by default.

Try the loop-capable product-development workflow:

```bash
npx omniskill@latest loop start grilled-product-dev --json
npx omniskill@latest loop status grilled-product-dev --latest --json
npx omniskill@latest loop advance grilled-product-dev --run <run-id> --json
```

That shape is useful for complex work: clarify the goal, move one action
forward, verify evidence, and keep advancing until the goal is done.

## Built-In Workflow Ecosystem

Omniskills workflows can compose local skills, bundled skills, and external
skill packs:

- Matt Pocock skills for TDD, review, design pressure-testing, domain modeling,
  PRDs, and issue slicing.
- Superpowers skills for brainstorming, planning, execution, and verification.
- Interface Craft skills for design engineering and motion. The canonical
  identifiers are `interface-craft:design-engineering`,
  `interface-craft:motion-vocabulary`,
  `interface-craft:fluid-interface-design`, and
  `interface-craft:motion-review`; they install from `emilkowalski/skills`.
  The older `emilkowalski:*` identifiers are compatibility aliases only.
- More workflow packs are coming.

`omniskill install` uses each workflow skill's `repo` metadata to fetch
missing external skills through the Skills CLI. For example,
`{ "source": "superpowers:brainstorming", "repo": "obra/superpowers" }`
keeps the original skill name in `source` and installs it with
`npx skills add obra/superpowers --skill brainstorming`.

If automatic bootstrap fails, run the package install through Omniskills and
retry:

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
npx omniskill@latest init <name>
npx omniskill@latest validate <source>
npx omniskill@latest skills install
npx omniskill@latest skills update
```

Run `npx omniskill@latest --help` or
`npx omniskill@latest <command> --help` for detailed usage.

The older `bundle` command remains a compatibility alias for `init`, `validate`,
and `lock`. The older `workflow` command remains a compatibility alias for
`install`, `list`, and `remove`.

## Create Your Own

Start with the [Create Your Own Workflow guide](docs/workflow-author-guide.md)
if you want to author and share a workflow bundle.

Create a new Omniskills workflow:

```bash
npx omniskill@latest init release-review
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
npx omniskill@latest skills install creating-bundle-skills
```

Then ask your agent to use:

```text
$creating-bundle-skills create an Omniskills workflow for release review
```

Validate before sharing:

```bash
npx omniskill@latest validate ./release-review
npx omniskill@latest deps ./release-review
```

The full guide is in [`docs/workflow-author-guide.md`](docs/workflow-author-guide.md).

## Examples

| Example | Use it for | Notes |
| --- | --- | --- |
| `examples/teams/startup-team` | Install a realistic startup operating team around one goal. | Includes the `$startup-goal` coordinator plus `$ceo`, `$cto`, `$product-manager`, `$web-design`, `$engineering-manager`, `$founding-engineer`, and `$qa-lead`. |
| `examples/workflows/ceo` | Company direction, strategy, tradeoffs, and decision mapping. | Uses Matt Pocock decision and grilling skills. |
| `examples/workflows/cto` | Architecture, domain model, technical risk, and review. | Uses Matt Pocock architecture/review skills. |
| `examples/workflows/product-manager` | Discovery, PRD, issue slicing, and product planning. | Uses Superpowers plus Matt Pocock PRD/issue skills. |
| `examples/workflows/web-design` | Interface direction, responsive interaction states, and animation review. | Uses the canonical Interface Craft skill identifiers. |
| `examples/workflows/engineering-manager` | Delivery sequencing, quality gates, and execution risk. | Uses planning, TDD, diagnosing, and review skills. |
| `examples/workflows/founding-engineer` | Implementation, tests, debugging, review, and final verification. | Uses `$implement` as the implementation role. |
| `examples/workflows/qa-lead` | Acceptance checks, regression focus, and release verification. | Uses review, diagnosing, and verification skills. |
| `examples/workflows/grilled-product-dev` | Goal loops for shaping product-development work into an approved plan. | Provides `loop start`, `loop status`, and `loop advance`. |
| `examples/workflows/openspec-superpowers` | Compatibility/demo workflow for OpenSpec delivery. | Kept for one release while the role catalog becomes the primary example set. |
| `examples/workflows/development-design-delivery` | Compatibility/demo workflow for product-minded engineering. | Richer composition example with verification. |
| `examples/workflows/real-engineering` | Compatibility/demo workflow combining RTK, Superpowers, and Matt Pocock skills. | Fetches external skills if missing. |
| `examples/workflows/release-review` | Compatibility/demo workflow for release-risk review. | Good minimal example. |
| `examples/workflows/haaland` | Curated playful Haaland/JTS meme workflow. | Generates one meme from its bundled profile asset. |

## Installed Files

By default, the CLI writes installed workflow records under your home directory:

```text
~/.omniskills/workflows/
```

Use `--dir <project>` when you intentionally want a project-local workflow
record.

Keep project-local `.omniskills/` folders out of git unless you
intentionally want to share installed workflow records.

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

Landing app:

```bash
cd landing
bun install
bun run dev
bun run build
```
