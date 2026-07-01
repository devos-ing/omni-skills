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
parsing, output formatting, and local snapshot prompts. It delegates bundle
behavior to `getsuperpower-command/`, skill installation to
`src/plugins/skill-installer.ts`, and install evidence to the snapshot runtime.

Primary commands:

- `getsuperpower init <name>`
- `getsuperpower validate <source>`
- `getsuperpower deps <source>`
- `getsuperpower install <source>`
- `getsuperpower list`
- `skills install [source]`
- `skills update [source]`
- `history`
- `revert <snapshot-id>`

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
- resolve bundled and local bundle sources
- list skill dependency sources
- install normalized project-local records under `.ponyrace/workflows/`
- list installed GetSuperpowers

The internal folder name remains `ponytrail` for compatibility with existing
imports. The product behavior is GetSuperpower-only.

## Skill Installer

`src/plugins/skill-installer.ts` installs reusable agent skills into supported
agent homes:

- Claude: `.claude/skills`
- Codex and shared agents: `.agents/skills`
- Codex mirror: `.codex/skills`
- Cursor: `.cursor/rules`

Supported sources include bundled skills, local skill directories, Superpowers
plugin-cache skills, Matt Pocock installed skills, and external packages routed
through the Skills CLI by `getsuperpower-command/`.

## Snapshot Evidence

`src/runtimes/ponytrail/snapshots.ts` keeps the local history used by skill and
bundle install commands. Snapshot entries live under `.ponyrace/` and may include
opt-in `instruction_context` metadata from `instruction-context.ts`.

Snapshots complement git. They record why a local skill or bundle install
changed files, what changed, and how to roll it back.

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
