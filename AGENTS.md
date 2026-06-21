# Repository Guidelines

This file gives AI agents the short operating map for this repository.

> **Single source of truth:** Keep this file concise. Architecture details live in
> `docs/architecture.md`; command definitions live in `package.json`; formatting
> and lint rules live in `biome.json`. Read those files before changing behavior.

## Quick Reference

### Architecture

Bun + TypeScript CLI runtime for supervising AI worker agents through a
requirement-first "Goal Court" flow.

- `src/cli.ts` - thin Commander CLI shell.
- `src/runtimes/goal-court/` - core runtime module for manifest validation,
  onboarding, goal drafting, and vote tallying.
- `src/plugins/` - plugin seam for worker adapters, evidence sources, and
  review integrations. Worker CLI adapters live in `src/plugins/adapters/`.
- `src/skills/` - skill seam for reusable judge and drafting capabilities.
- `tests/` - Bun tests for runtime behavior and CLI command registration.
- `docs/architecture.md` - authoritative architecture map.
- `outputs/` - user-facing generated artifacts.
- `work/` - scratch space for local smoke tests and temporary files.

### Runtime Flow

```text
Human request
  -> CLI
  -> goal-court runtime
  -> requirements brainstorm
  -> ask human for details when unclear
  -> manifest-defined models, bots, and skills
  -> 2 of 3 direction approval
  -> human lock
  -> worker adapter streams Codex, Claude, or another agent
  -> evidence is collected
  -> verdict
```

## Module Boundaries

- `src/cli.ts` must stay thin. It may parse commands, prompt users, print
  output, and call runtime interfaces. It must not own goal-court rules.
- `src/runtimes/goal-court/` owns the requirement-first lifecycle. Put manifest
  schemas, goal contracts, onboarding behavior, and vote rules here.
- `src/plugins/` is for adapters and integration contracts. Plugin code should
  hide environment-specific behavior behind small interfaces.
- Worker CLI adapter folders exist for Codex CLI, Claude CLI, and GitHub
  Copilot CLI under `src/plugins/adapters/`. Process spawning and streaming
  must stay behind this seam, never in `src/cli.ts`.
- Each worker adapter folder should keep the same shape: `commands.ts` builds
  invocations, `helpers.ts` runs or streams them through injected runners,
  `utils.ts` stores adapter-local constants/config, and `index.ts` exports the
  public adapter surface.
- `src/skills/` is for reusable bot capability definitions and instructions.
  Skills should describe review behavior; they should not perform runtime side
  effects directly.
- Generated `.goal-court/` project workspaces are local runtime state. Do not
  make source code depend on files generated during smoke tests.

## Goal Court Rules

- Requirements brainstorm runs before bot discussion. If the request is vague,
  the runtime must ask the human owner for missing outcome, scope, and evidence
  details before drafting a goal.
- Bot model selection is manifest-defined. Add or edit models in
  `manifest.models`, then point each bot at a model id through `bot.model`.
- Goals are drafted before worker agents execute.
- A goal direction requires at least 2 approvals from the 3 review bots:
  Product, Engineering, and Verification.
- Human owner approval is required before a goal becomes locked.
- Worker agents must request `/amend-goal` instead of silently changing scope.
- Evidence should be append-only: raw request, drafts, critiques, votes, human
  decisions, locked contract, actions, commands, changed files, and checks.

## Commands

```bash
bun install                 # Install dependencies
bun run dev -- --help       # Show CLI commands
bun run dev -- onboard      # Create local .goal-court files
bun run dev -- bots         # List manifest-defined bots
bun run dev -- goal "..."   # Draft a goal contract
bun run build               # Build the packaged CLI bundle
bun run dev -- vote --votes '[...]'
bun run dev -- stream-goal "..."                  # Stream through the first configured worker
bun run dev -- stream-goal --worker claude "..."  # Stream through a named manifest worker
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
rtk bun run dev -- onboard --dir work/smoke-runtime --name "Smoke Runtime" --yes
rtk bun run dev -- bots --manifest work/smoke-runtime/.goal-court/manifest.json
```
