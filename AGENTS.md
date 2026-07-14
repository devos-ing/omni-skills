# Repository Guidelines

This file gives AI agents the short operating map for this repository.

> **Single source of truth:** Keep this file concise. Architecture details live in
> `docs/architecture.md`; command definitions live in `package.json`; formatting
> and lint rules live in `biome.json`. Read those files before changing behavior.

## Quick Reference

### Architecture

Bun + TypeScript CLI runtime for authoring, installing, and validating
Omniskills workflow and team bundles.

- `src/cli.ts` - thin Commander CLI shell.
- `src/omniskill.ts` - primary Omniskills command module.
- `src/runtimes/omniskill/` - internal runtime for workflow
  manifests and install records; snapshot modules are paused from the public CLI.
- `src/plugins/` - skill installer seam for bundled, local, Superpowers,
  external, and agent-target installs.
- `tests/` - Bun tests for runtime behavior and CLI command registration.
- `docs/architecture.md` - authoritative architecture map.
- `work/` - scratch space for local smoke tests and temporary files.

### Runtime Flow

```text
Author or user request
  -> omniskill CLI
  -> workflow manifest validation
  -> optional workflow.lock skill fingerprint validation
  -> skill dependency resolution
  -> Skills CLI bootstrap when needed
  -> agent skill target installs
  -> .omniskills workflow records
```

## Module Boundaries

- `src/cli.ts` must stay thin. It may parse commands, prompt users, print
  output, and call runtime or plugin interfaces. It must not own bundle rules.
- `src/omniskill.ts` owns Omniskills command registration and skill
  dependency bootstrap for install/deps/init/validate/lock/list/remove/onboard/loop.
- `src/runtimes/omniskill/` owns workflow manifest schemas, scaffolding,
  lock files, install records, removal plans, and loop metadata.
- `src/plugins/` is for skill resolution and target writes. Keep
  environment-specific behavior behind small interfaces.
- Generated `.omniskills/` project workspaces are local runtime state. Do not
  make source code depend on files generated during smoke tests.

## Omniskills Rules

- An Omniskills bundle is a deployable skills set with a `workflow.json`,
  optional `workflow.lock.json`, README, and optional local skills. Omitted
  `kind` means workflow; first-class teams declare `kind: "team"` plus a local
  declared `coordinator` and unique local declared `members`.
- `startup-team` under `examples/teams/startup-team` is the primary public team.
  Role workflows such as `cto`, `product-manager`, and `founding-engineer`
  remain independently installable public examples.
- If a workflow provides one callable entry skill, that skill must be listed in
  `skills[]`; it does not need a workflow step.
- Every `steps[].skill` value must exactly match a declared `skills[].source`.
- `omniskill install` is the only public workflow or team install command.
- The older `bundle` and `workflow` command surfaces exist only as
  compatibility aliases.
- Pony Trail history, revert, and prehook features are paused. Do not expose or
  document them as active CLI commands unless the feature is explicitly resumed.

## Commands

```bash
bun install                 # Install dependencies
bun run dev -- --help       # Show CLI commands
bun run dev -- install examples/teams/startup-team
bun run dev -- deps examples/teams/startup-team
bun run dev -- list
bun run dev -- remove startup-team --dry-run
bun run dev -- loop status examples/workflows/grilled-product-dev --latest --json
bun run dev -- init my-workflow
bun run dev -- lock examples/workflows/cto
bun run dev -- validate examples/workflows/cto
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
rtk bun run dev -- deps examples/teams/startup-team
rtk bun run dev -- validate examples/teams/startup-team
```
