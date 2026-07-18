# Omniskills Architecture

This repository focuses on Omniskills workflow and team skill bundles. The
older Ponyrace requirement-review runtime has been removed from source.

## Source Map

```text
src/
  cli.ts
  plugins/
    agent-profile-installer.ts
    orchestration-dispatcher.ts
    orchestration-run-store.ts
    skill-installer.ts
  runtimes/
    omniskill/
      orchestration-dispatch.ts
      orchestration.ts
      workflow-bundles.ts
      workflow-loop-runtime.mjs
      workflow-milestones.mjs
```

## CLI

`src/cli.ts` is a thin Commander shell. It owns command registration, option
parsing, and output formatting. It delegates bundle behavior to
`src/omniskill.ts` and skill installation to `src/plugins/skill-installer.ts`.

Primary commands:

- `omniskill init <name>`
- `omniskill validate <source>`
- `omniskill lock <source>`
- `omniskill deps <source>`
- `omniskill install <source>`
- `omniskill list`
- `omniskill remove <workflow-name>`
- `omniskill setup-model-routing --list-models --json`
- `omniskill setup-model-routing --planning-model <slug> --planning-effort <effort> --implementation-model <slug> --implementation-effort <effort> --verification-model <slug> --verification-effort <effort> --dry-run --json`
- `omniskill loop <start|status|log|advance|summary> <source>`
- `skills install [source]`
- `skills update [source]`

Agent launch is disabled and excluded from the production CLI dependency graph
because the execution path can cause increasing memory usage. Workflow and team
bundles, generated profile metadata, and `setup-model-routing` remain available.
Existing dispatch run files are preserved but cannot be started or resumed
through the CLI.

Compatibility aliases:

- `bundle init`
- `bundle validate`
- `bundle lock`
- `workflow install`
- `workflow list`
- `workflow remove`

## Omniskills Runtime

`src/runtimes/omniskill/workflow-bundles.ts` owns the bundle contract:

- parse and validate `workflow.json`
- preserve omitted `kind` as a legacy workflow and validate first-class
  `kind: "team"` manifests with one local entry `coordinator`, unique declared
  `members` that resolve to child workflows, and no coordinator/member overlap
- parse and validate optional `workflow.lock.json`
- generate deterministic skill fingerprints for local and external skill
  sources through `omniskill lock <source>`
- allow only the explicit pre-publication workflow and team examples to omit
  `workflow.lock.json`; public examples must carry schema `0.2` locks
- validate optional loop metadata: `loop`, one `skills[].entry`, and
  `steps[].instruction`
- reject duplicate step ids
- scaffold a local bundle with an entry skill
- resolve local and public git bundle sources; bare `*-team` aliases route to
  `examples/teams/<name>`, while other bare aliases route to
  `examples/workflows/<name>`
- recursively resolve child workflows before installation, select the highest
  declared semantic version for duplicate workflow names, deduplicate leaf
  skills, and reject cycles with the full active workflow path
- list skill dependency sources plus optional Skills CLI repository metadata
- prepare looped workflow entry skill installs with copied `workflow.json`,
  generated `loop.mjs`, and generated `loop.metadata.json`
- install normalized global records under `~/.omniskills/workflows/` with
  exact skill artifact metadata for later removal
- validate vendor-neutral team orchestration assignments and compile them into
  deterministic Codex TOML and Claude Markdown profile plans
- preserve optional `modelRole` labels on orchestration assignments so Codex
  profiles can route `planning`, `implementation`, and `verification` work
  through global schema `0.2` selections
- require `steps[].phase: "implementation"` for every skill granted
  orchestration `workspace-write` access, and require labeled
  `workspace-write` assignments to use `modelRole: "implementation"`
- preserve managed agent-profile ownership hashes in workflow records so
  removal deletes unchanged generated profiles and keeps user-modified files
- list installed Omniskills workflows and teams
- plan and execute removal of installed bundle skill artifacts while
  preserving artifacts referenced by other install records

The runtime folder retains the singular `omniskill` name internally.

## Skill Installer

`src/plugins/skill-installer.ts` installs reusable agent skills into supported
agent homes:

- Claude: `.claude/skills`
- Codex: `.agents/skills`, with a compatibility mirror at `.codex/skills`
- Cursor: `.cursor/rules`
- Hermes: `.hermes/skills`
- OpenClaw: `.agents/skills`
- opencode/OpenCodex: `.agents/skills`
- GitHub Copilot: `.agents/skills` through the `copilot` or `github-copilot`
  target aliases

`opencodex` is accepted as an alias for the canonical `opencode` target.
Repeated shared destinations are handled once per install/update operation, so
requesting Codex, OpenClaw, opencode, and Copilot together does not copy the
shared `.agents/skills` destination multiple times.

`src/plugins/agent-profile-installer.ts` owns the native orchestration profile
filesystem boundary. It plans the shared `~/.omniskills/orchestration.json`
configuration, classifies create/update/conflict states, writes profile batches
with rollback, and leaves team routing rules in the Omniskills runtime.
For Codex targets, installation discovers the signed-in identity's visible
models through the read-only `codex debug models` plugin seam. Exact legacy
generated configuration may migrate to catalog-derived defaults; custom
configuration is validated but never rewritten automatically.
`src/plugins/model-routing-setup.ts` plans the explicit
`omniskill setup-model-routing` transaction across global config, managed Codex
profiles, and installed workflow records. Schema `0.1` remains readable through
an effective compatibility mapping; schema `0.2` stores Codex-only global
`planning`, `implementation`, and `verification` model candidates.

The dispatch runtime, Codex adapter, and run-store source files remain in the
repository for rollback and diagnosis. Production barrel files do not export
them, and the shipped CLI does not import them. Direct focused tests preserve
their behavior without making agent launch available.

Supported sources include bundled skills, local skill directories, Superpowers
plugin-cache skills, Matt Pocock installed skills, and external packages routed
through the Skills CLI by `src/omniskill.ts`. Workflow manifests can keep
the original step skill name in `skills[].source` and declare the installable
Skills CLI package in `skills[].repo`.
When a repo-backed skill is also an orchestration role and is not locally
resolvable before bootstrap, `skills[].installedName` declares its validated
target name. Once the skill exists, installer metadata must match that value.

## Runtime State

Installed workflow records live under
`~/.omniskills/workflows/`; project-local records are only written when a
caller passes `--dir`. Optional looped workflows may write per-run state under
`~/.omniskills/runs/<workflow>/<run-id>/` through `omniskill loop` or the
compatibility `loop.mjs` wrapper. Dispatch run directories from older versions
may contain `request.json`, `plan.json`, `attempts.jsonl`, and `receipt.json`,
but the current CLI cannot create or resume them.

## Bundle Layout

```text
my-omniskill-workflow/
  workflow.json
  workflow.lock.json
  README.md
  skills/
    my-omniskill-workflow/
      SKILL.md
    optional-local-skill/
      SKILL.md
```

`skills/<name>/SKILL.md` is the callable entry skill. Its required sub-skills
should stay aligned with `workflow.json`.

A first-class team uses the same file layout under `examples/teams/<name>` and
declares `kind: "team"`, `coordinator`, and `members` in `workflow.json`.
The coordinator is one declared local entry skill. Every `members[]` source
must be declared in `skills[]` and resolve to a child workflow with exactly one
local entry skill. Member dependencies expand recursively, but only the root
team install record is written. For `startup-team`, startup-goal remains the
callable coordinator while seven canonical standalone role workflows provide
the members. The public bundle installs as `startup-team`; users invoke
`$startup-goal` after installation.

`finance-team` and `market-team` use the same first-class team contract.
`finance-team` composes `company-analysis`, `financial-analysis`,
`valuation-analysis`, and the shared `risk-analysis` workflow behind the local
`finance-research` coordinator. `market-team` composes `macro-analysis`,
`rates-analysis`, `market-structure`, `sector-analysis`, and the same shared
`risk-analysis` workflow behind `market-research`. Every coordinator and member
uses a read-only orchestration profile; risk analysis uses the verification
model role. Recursive dependencies are installed under one root-only team
install record. Checked-in teams use explicit relative child workflow sources
so the root and every member come from one checkout. Finance and Market remain
lockless local previews until their complete graphs pass the public catalog
release smoke.

`workflow.lock.json` is generated by `omniskill lock <source>`. It records
deterministic hashes for local skill files and fingerprints the declared
external locator. It does not snapshot a moving upstream branch, so public
manifests must use exact commit locators. Missing lock files remain
valid for compatibility, but checked-in public workflows should include them.

Parents declare only direct dependencies. A local dependency directory that
contains `workflow.json` is a child workflow and is scanned recursively. Direct
repository URLs, including `#subdirectory` fragments, work the same way.
`catalog:<alias>` selects a released canonical catalog workflow without making
ordinary bare skill names ambiguous; it never silently prefers a nearby local
directory. Teams that must compose one checkout use relative child workflow
paths instead. `installed:<name>` reopens an installed workflow's recorded
source. `skill-tree-demo` is the minimal local example.

New locks use schema `0.2`: they store the selected workflow nodes and edges,
exact git commits, and fingerprints for the fully expanded leaf skill set.
Locked git children fetch their recorded commit directly on repeat installs.
Legacy `0.1` locks remain valid for flat workflows; once a child workflow is
detected, authors must regenerate the lock. Child workflows with the same name
must declare valid semantic versions, and the highest version's subtree wins.

Loop-enabled workflows declare `loop` in `workflow.json`, mark exactly one local
skill with `entry: true`, and keep phase instructions in `steps[].instruction`.
`loop.script` names the generated compatibility runner output path, usually
`./loop.mjs`; workflow authors do not need to check in that file. Install copies
`workflow.json` and generated `loop.metadata.json` plus generated `loop.mjs`
only into the entry skill destination.

Goal-based loops add `loop.type: "goal_based"`, `loop.goal`,
`loop.done_when`, and `loop.stop_when` while keeping `execution:
"action-only"`. The runtime exposes that goal contract in `loop start` and
`loop status` output, and optional `steps[].verify` rules add a verification
action before the generated advance action.

Milestone-based team loops add `loop.type: "milestone_based"` and explicit
coordinator, implementer, and verifier owners. `workflow-milestones.mjs` owns
the Zod-validated goal tunnel, feature milestones, input and output packets,
evidence gaps, approval decisions, transition table, and User Outcome Replay.
`workflow-loop-runtime.mjs` persists that state under the normal run directory,
projects only safe review fields in status and summaries, and emits an
action-only request for the host coordinator to launch the configured internal
role with the exact structured event required by the current stage. The runtime
does not spawn a process or restore public CLI dispatch. When host launch or the
installed role profile is unavailable, the coordinator emits a
`Prepared, not executed` fallback. Critical evidence gaps pause advancement,
and scope changes block the run pending renewed human approval; role reasoning
methods remain outside the coordinator and runtime contracts. Finance Team and
Market Team retain their manual-only coordinator policies.

## Boundaries

- Keep CLI behavior thin and route implementation through runtime or plugin
  seams.
- Keep `workflow-bundles.ts` focused on bundle manifests and install records.
- Keep `skill-installer.ts` focused on skill source resolution and target writes.
- Do not reintroduce requirement-court commands, role review modules, or worker
  pony adapters into this codebase.
