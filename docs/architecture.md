# GetSuperpower Architecture

This repository now focuses on GetSuperpower bundle skills. The older Ponyrace
requirement-review runtime has been removed from source.

## Source Map

```text
src/
  cli.ts
  plugins/
    skill-installer.ts
  runtimes/
    ponytrail/
      instruction-context.ts
      snapshots.ts
      workflow-bundles.ts
```

## CLI

`src/cli.ts` is a thin Commander shell. It owns command registration, option
parsing, and output formatting. It delegates bundle behavior to
`src/getsuperpower.ts` and skill installation to `src/plugins/skill-installer.ts`.

Primary commands:

- `getsuperpower init <name>`
- `getsuperpower validate <source>`
- `getsuperpower deps <source>`
- `getsuperpower install <source>`
- `getsuperpower list`
- `skills install [source]`
- `skills update [source]`

Compatibility aliases:

- `bundle init`
- `bundle validate`
- `workflow install`
- `workflow list`

## GetSuperpower Runtime

`src/runtimes/ponytrail/workflow-bundles.ts` owns the bundle contract:

- parse and validate `workflow.json`
- reject duplicate step ids
- scaffold a local bundle with an entry skill
- resolve local and public git bundle sources
- list skill dependency sources plus optional Skills CLI repository metadata
- install normalized project-local records under `.getsuperpower/workflows/`
- list installed GetSuperpowers

The internal folder name remains `ponytrail` for compatibility with existing
imports. The product behavior is GetSuperpower-only.

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
through the Skills CLI by `src/getsuperpower.ts`. Workflow manifests can keep
the original step skill name in `skills[].source` and declare the installable
Skills CLI package in `skills[].repo`.

## Paused Pony Trail Runtime

`src/runtimes/ponytrail/snapshots.ts` and
`src/runtimes/ponytrail/instruction-context.ts` remain in the source tree for
future or legacy use, but the public GetSuperpower CLI does not expose history,
revert, or prehook commands while Pony Trail is paused.

Skill install and workflow install commands do not write snapshot history during
this pause. Active project-local state is limited to installed workflow records
under `.getsuperpower/workflows/`.

## Bundle Layout

```text
my-getsuperpower/
  workflow.json
  README.md
  skills/
    my-getsuperpower/
      SKILL.md
    optional-local-skill/
      SKILL.md
```

`skills/<name>/SKILL.md` is the callable entry skill. Its required sub-skills
should stay aligned with `workflow.json`.

## Boundaries

- Keep CLI behavior thin and route implementation through runtime or plugin
  seams.
- Keep `workflow-bundles.ts` focused on bundle manifests and install records.
- Keep `skill-installer.ts` focused on skill source resolution and target writes.
- Do not reintroduce requirement-court commands, role review modules, or worker
  pony adapters into this codebase.
