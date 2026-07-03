# Repository Guidelines

This file gives AI agents the short operating map for this repository.

> **Single source of truth:** Keep this file concise. Architecture details live in
> `docs/architecture.md`; command definitions live in `package.json`; formatting
> and lint rules live in `biome.json`. Read those files before changing behavior.

## Quick Reference

### Architecture

Bun + TypeScript CLI runtime for authoring, installing, and validating
GetSuperpower skill-tree bundles.

- `src/cli.ts` - thin Commander CLI shell.
- `src/getsuperpower.ts` - primary GetSuperpower command module.
- `src/runtimes/ponytrail/` - internal compatibility runtime for workflow
  manifests and install records; snapshot modules are paused from the public CLI.
- `src/plugins/` - skill installer seam for bundled, local, Superpowers,
  external, and agent-target installs.
- `tests/` - Bun tests for runtime behavior and CLI command registration.
- `docs/architecture.md` - authoritative architecture map.
- `work/` - scratch space for local smoke tests and temporary files.

### Runtime Flow

```text
Author or user request
  -> getsuperpower CLI
  -> workflow manifest validation
  -> skill dependency resolution
  -> Skills CLI bootstrap when needed
  -> agent skill target installs
  -> .getsuperpower workflow records
```

## Module Boundaries

- `src/cli.ts` must stay thin. It may parse commands, prompt users, print
  output, and call runtime or plugin interfaces. It must not own bundle rules.
- `src/getsuperpower.ts` owns GetSuperpower command registration and skill
  dependency bootstrap for install/clone/deps/init/validate/list.
- `src/runtimes/ponytrail/` owns workflow manifest schemas, scaffolding, and
  install records. The folder name remains for internal compatibility.
- `src/plugins/` is for skill resolution and target writes. Keep
  environment-specific behavior behind small interfaces.
- Generated `.getsuperpower/` project workspaces are local runtime state. Do not
  make source code depend on files generated during smoke tests.

## GetSuperpower Rules

- A GetSuperpower is a deployable bundle skills set with a `workflow.json`,
  README, and optional local skills.
- If a workflow provides one callable entry skill, that skill must be listed in
  `skills[]`; it does not need a workflow step.
- Every `steps[].skill` value must exactly match a declared `skills[].source`.
- `getsuperpower install` and `getsuperpower clone` are the same operation.
- The older `bundle` and `workflow` command surfaces exist only as
  compatibility aliases.
- Pony Trail history, revert, and prehook features are paused. Do not expose or
  document them as active CLI commands unless the feature is explicitly resumed.

## Commands

```bash
bun install                 # Install dependencies
bun run dev -- --help       # Show CLI commands
bun run dev -- install examples/workflows/release-review
bun run dev -- clone examples/workflows/release-review
bun run dev -- deps examples/workflows/release-review
bun run dev -- init my-workflow
bun run dev -- validate examples/workflows/real-engineering
bun run dev -- skills install
bun run build               # Build the packaged CLI bundle
bun test                    # Run Bun tests
bun run coverage            # Run tests and enforce 90% line coverage
bun run deps:check-recency -- <package[@version]>
bun run typecheck           # TypeScript check
bun run check               # Biome + typecheck + coverage gate
```

The shell environment for this workspace expects commands to be prefixed with
`rtk` when run by Codex, for example `rtk bun run check`.

## Development Rules

- Prefer test-first changes for runtime behavior. Add or update a focused Bun
  test before changing production TypeScript.
- The coverage gate is 90% line coverage. Do not chase 100% coverage by
  testing low-value details; add meaningful tests around runtime behavior,
  adapter seams, and failure modes.
- Keep interfaces small and deep. Callers should use runtime exports instead of
  reaching into internal files unnecessarily.
- Use Zod for manifest and user-provided JSON validation.
- Use Zod schemas to replace `any` types with validated `unknown` inputs and
  inferred TypeScript types.
- Keep onboarding deterministic and safe to run repeatedly in a scratch
  directory.
- Do not add live Codex, Claude, network, or filesystem side effects to core
  modules without routing them through a plugin seam.
- Do not install a new npm package version published less than 30 days ago.
  Before adding dependencies, run
  `rtk bun run deps:check-recency -- <package[@version]>`. If the selected
  version is newer than 30 days, choose an older stable version or ask the
  human owner for explicit approval.

## Verification

Before claiming completion, run:

```bash
rtk bun run check
```

For CLI changes, also run a smoke check against a scratch directory under
`work/`, such as:

```bash
rtk bun run dev -- --help
rtk bun run dev -- deps examples/workflows/release-review
rtk bun run dev -- validate examples/workflows/release-review
```
