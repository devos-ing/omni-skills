# Omniskills Architecture

This repository focuses on Omniskills workflow and team skill bundles. The
older Ponyrace requirement-review runtime has been removed from source.

## Source Map

```text
src/
  cli.ts
  plugins/
    skill-installer.ts
  runtimes/
    omniskill/
      workflow-bundles.ts
      workflow-loop-runtime.mjs
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
- `omniskill loop <start|status|log|advance|summary> <source>`
- `skills install [source]`
- `skills update [source]`

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
- opencode/OpenCodex: `.agents/skills`
- GitHub Copilot: `.agents/skills` through the `copilot` or `github-copilot`
  target aliases

`opencodex` is accepted as an alias for the canonical `opencode` target.
Repeated shared destinations are handled once per install/update operation, so
requesting Codex, opencode, and Copilot together does not copy the same skill
directory multiple times.

Supported sources include bundled skills, local skill directories, Superpowers
plugin-cache skills, Matt Pocock installed skills, and external packages routed
through the Skills CLI by `src/omniskill.ts`. Workflow manifests can keep
the original step skill name in `skills[].source` and declare the installable
Skills CLI package in `skills[].repo`.

## Runtime State

Installed workflow records live under
`~/.omniskills/workflows/`; project-local records are only written when a
caller passes `--dir`. Optional looped workflows may write per-run state under
`~/.omniskills/runs/<workflow>/<run-id>/` through `omniskill loop` or the
compatibility `loop.mjs` wrapper.

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

`workflow.lock.json` is generated by `omniskill lock <source>`. It records
deterministic hashes for local skill files and stable fingerprints for external
skill sources so reviewers can see when a workflow's skill tree changed. Missing
lock files remain valid for compatibility, but checked-in public workflows
should include them.

Parents declare only direct dependencies. A local dependency directory that
contains `workflow.json` is a child workflow and is scanned recursively. Direct
repository URLs, including `#subdirectory` fragments, work the same way.
`catalog:<alias>` selects a canonical catalog workflow without making ordinary
bare skill names ambiguous, and `installed:<name>` reopens an installed
workflow's recorded source. `skill-tree-demo` is the minimal local example.

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

## Boundaries

- Keep CLI behavior thin and route implementation through runtime or plugin
  seams.
- Keep `workflow-bundles.ts` focused on bundle manifests and install records.
- Keep `skill-installer.ts` focused on skill source resolution and target writes.
- Do not reintroduce requirement-court commands, role review modules, or worker
  pony adapters into this codebase.
