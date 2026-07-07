# Add CLI Loop Command

## Summary

Add a root `getsuperpower loop` command with subcommands for looped workflow
run control. Agents and docs should use the CLI command instead of invoking
`node loop.mjs` directly.

## Problem

The current loop runtime works, but the public execution contract leaks the
installed implementation detail:

```bash
node loop.mjs status --latest --json
```

That is awkward for agents and authors because the user-facing product is the
GetSuperpower CLI, not a Node wrapper file copied into an installed skill. It
also means runtime action suggestions currently tell agents to run
`node loop.mjs ...`, which is the wrong abstraction.

## Proposed Change

Expose loop execution through CLI subcommands:

```bash
getsuperpower loop start <source> --json
getsuperpower loop status <source> --latest --json
getsuperpower loop log <source> --run <id> --type phase_result --message "..."
getsuperpower loop advance <source> --run <id> --json
getsuperpower loop summary <source> --run <id> --json
```

The `<source>` argument should use the existing workflow source resolver where
possible: workflow alias, local workflow directory, `workflow.json` path, or
public git source. The command should load the workflow manifest, call the
shared loop runtime, and preserve the existing JSON/plain output behavior.

The workflow-local `loop.mjs` wrapper can remain as a portable compatibility
asset for installed entry skills, but it should stop being the documented or
agent-facing way to operate a loop.

## Scope

In scope:

- add `getsuperpower loop` with `start`, `status`, `log`, `advance`, and
  `summary` subcommands;
- route the CLI command through the existing reusable loop runtime instead of
  duplicating loop logic;
- update runtime action commands and error/help text so they point to
  `getsuperpower loop ...`;
- update the grilled-product-dev entry skill and docs to use the CLI command;
- keep `node loop.mjs` compatibility for installed/runtime portability unless
  a later proposal removes it.

Out of scope:

- executing workflow phases or tools automatically;
- changing the loop state schema;
- changing the `loop` manifest shape;
- removing copied `loop.mjs` / `loop-runtime.mjs` files from installed entry
  skills.

## Risks

- CLI argument order must be obvious and test-covered, otherwise authors may
  keep reaching for `node loop.mjs`.
- Public git workflow sources may require cleanup after loop commands, just as
  validate/install do.
- Runtime action strings need enough source context to print useful CLI
  commands without hard-coding local filesystem details into installed skills.

## Approved V1 Decisions

1. Require `<source>` on every loop subcommand.
2. Use subcommand-first order:
   `getsuperpower loop <start|status|log|advance|summary> <source>`.
3. Defer installed workflow-name lookup from
   `~/.getsuperpower/workflows/<name>.json` to a later proposal.
