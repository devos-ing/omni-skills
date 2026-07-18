# Omniskills

[繁體中文](README.zh-Hant.md)

Power your ability.

Omniskills is a many-skill bank for AI agents: install one workflow skill
tree, call one entry skill with a goal, and give your agent the right roles,
playbooks, and verification habits for the problem in front of it. The point is
simple: 3x your ability without manually juggling every specialist skill.

Start with Startup Team to break one approved startup goal into evidence-backed
feature milestones, review each plan before implementation, verify the result,
and replay the user's expectations, needs, wishes, and journey before
acceptance. Each Evidence Ledger distinguishes Verified, Inferred, and Assumed
claims. On a capable host, selected startup-team roles run as internal
subagents with bounded stage packets. The flow stops for plan approval and
feature acceptance; `Prepared, not executed` is only the fallback when internal
launch or the installed role profile is unavailable. Public CLI dispatch stays
disabled.

The installed bench still includes CEO, CTO, Product Manager, Web Design,
Engineering Manager, Founding Engineer, and QA Lead; the active milestone uses
only the roles it needs. After implementation, one bounded in-scope rework can
return fresh evidence to QA when needed.

`Prepare -> Plan -> Plan approval -> Implement -> Rework if needed -> Verify -> User Outcome Replay -> Feature acceptance`

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

### Finance Team (local preview)

Finance Team is not published through `omniskill@latest` yet. From a clone of
this repository, install the checked-out team and invoke `$finance-research` to
prepare company, financial, valuation, and risk handoffs for one sourced
public-company brief.

```bash
bun run dev -- install examples/teams/finance-team
```

### Market Team (local preview)

Market Team is not published through `omniskill@latest` yet. From a clone of
this repository, install the checked-out team and invoke `$market-research` to
prepare macro, rates, market-structure, sector, and risk handoffs for one
sourced regime brief.

```bash
bun run dev -- install examples/teams/market-team
```

Both teams use host-provided browsing and public sources. They require no
market-data API and do not provide personalized investment advice. Automatic
role launch is disabled for these two previews: run each `Prepared, not
executed` handoff in a separate user-controlled task and return its completed
output to the coordinator.

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

### Installation truth

Startup Team carries a checked-in schema `0.2` lock. Its external GitHub
locators use exact commits, and every declared team member resolves from the
same checkout as the root team. The lock fingerprints the declared dependency
graph and locators; it does not independently snapshot downloaded remote
contents.

On reinstall, Omniskills refreshes an existing target only when its recorded
artifact paths establish ownership. A target with mixed ownership, such as a
managed primary and a user-owned mirror, is skipped instead of replacing the
user-owned copy. Finance Team and Market Team remain lockless local previews
until their full graphs pass the publication smoke.

## Workflow Registry

Use the registry view to pick an Omniskills workflow, inspect its role workflow, and
copy the install command.

<img src="assets/omniskill-startup-role-registry.png" alt="Omniskills startup role workflow registry" width="920" />

## Startup Role Workflows

| Omniskills workflow | Entry skill | What it helps with |
| --- | --- | --- |
| Startup Team | `$startup-goal` | Move one evidence-backed feature milestone at a time through plan approval, implementation, conditional rework, verification, User Outcome Replay, and feature acceptance. |
| Finance Team (local preview) | `$finance-research` | Prepare company, financial, valuation, and risk handoffs for a sourced public-company brief. |
| Market Team (local preview) | `$market-research` | Prepare macro, rates, market-structure, sector, and risk handoffs for a sourced market-regime brief. |
| CEO | `$ceo` | Direction, hard tradeoffs, fundraising/customer framing, and company decisions. |
| CTO | `$cto` | Architecture, domain model, platform direction, and engineering risk. |
| Product Manager | `$product-manager` | Product discovery, PRDs, acceptance criteria, roadmap tradeoffs, and issue slicing. |
| Web Design | `$web-design` | Implementable interface direction, responsive interaction states, and rigorous animation review. |
| Engineering Manager | `$engineering-manager` | Delivery sequencing, execution risk, quality gates, blocker triage, and engineering process. |
| Founding Engineer | `$founding-engineer` | Read-only implementation framing: affected seams, test strategy, technical risk, and execution handoff. |
| QA Lead | `$qa-lead` | Release-risk review, acceptance checks, regression focus, reproduction gaps, and verification evidence. |

Each workflow is still just files you can inspect: a `workflow.json`, optional
`workflow.lock.json`, README, and local skills. The power comes from installing
the skill tree once and then calling the entry skill that knows which companion
skills to use.

### Which workflow should I use?

| Need | Choose | Where it stops |
| --- | --- | --- |
| Move one startup feature from direction through acceptance | `startup-team` | After QA, User Outcome Replay, and human feature acceptance; only the implement role writes. |
| Make one product decision or define customer-value scope | `product-manager` | A read-only product recommendation, spec, ticket set, or delivery plan. |
| Turn a vague product request into an approved plan | `grilled-product-dev` | An approved implementation plan; it does not implement the work. |
| Deliver a product or interface change with prototyping and review | `development-design-delivery` | Verified implementation evidence after the approved design and plan. |
| Deliver a general engineering change with repository command discipline | `real-engineering` | Verified engineering evidence after planning, TDD, and debugging. |

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
- Emil Kowalski skills for design engineering and motion. The canonical
  identifiers are `emilkowalski:emil-design-eng`,
  `emilkowalski:animation-vocabulary`, `emilkowalski:apple-design`, and
  `emilkowalski:review-animations`; they install from the audited commit
  `https://github.com/emilkowalski/skills/tree/6bf24434f7730ad169077756cf9c7cd7bd675fc6`.
  The older `interface-craft:*` identifiers are compatibility aliases only.
- More workflow packs are coming.

`omniskill install` uses each workflow skill's `repo` metadata to fetch
missing external skills through the Skills CLI. For example,
`{ "source": "superpowers:brainstorming", "repo": "https://github.com/obra/superpowers/tree/d884ae04edebef577e82ff7c4e143debd0bbec99" }`
keeps the original skill name in `source` and installs it with
`npx skills add https://github.com/obra/superpowers/tree/d884ae04edebef577e82ff7c4e143debd0bbec99 --skill brainstorming`.

If automatic bootstrap fails, run the package install through Omniskills and
retry:

```bash
npx omniskill@latest skills install mattpocock/skills
```

Omniskills can install reusable skills into specific agent targets:

```bash
npx omniskill@latest skills install writing-workflow-skills \
  --agents codex,claude,cursor,copilot,hermes,openclaw,opencode
```

These are skill-install targets only. Host-managed internal role execution
depends on the agent environment; public CLI dispatch is disabled.

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
| `examples/workflows/web-design` | Interface direction, responsive interaction states, and animation review. | Uses the canonical Emil Kowalski skill identifiers. |
| `examples/workflows/engineering-manager` | Delivery sequencing, quality gates, and execution risk. | Uses planning, TDD, diagnosing, and review skills. |
| `examples/workflows/founding-engineer` | Read-only implementation framing, affected seams, test strategy, and technical risk. | Hands the approved frame to a separate implementer. |
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
