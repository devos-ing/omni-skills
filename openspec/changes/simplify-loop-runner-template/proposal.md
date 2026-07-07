# Simplify Loop Runner Template

## Summary

Merge the current two-file installed loop runtime shape into one generated
`loop.mjs` runner. Generic loop functions should live in the GetSuperpower CLI;
installed workflow skills should only carry workflow-specific variables and
metadata.

## Problem

The current looped workflow install copies both:

```text
loop.mjs
loop-runtime.mjs
```

That makes the installed skill look heavier than the actual product contract.
`loop.mjs` is only a wrapper, while `loop-runtime.mjs` contains generic runtime
logic already owned by the CLI. It also means example workflows and installed
skills can drift from the CLI runtime if a copied file is stale.

The owner wants a simpler model:

- no duplicated generic runtime code inside each installed skill;
- no hand-maintained runtime implementation in workflow-local `loop.mjs`;
- only dynamic workflow variables saved with the skill;
- a generic function/template provided by the CLI and automatically filled when
  generating the runner.

## Proposed Change

Use the CLI as the loop runtime provider and generate `loop.mjs` from a small
template during workflow preparation/install.

The generated runner should contain only dynamic values such as:

```js
const workflowJson = new URL("./workflow.json", import.meta.url);
const cliCommand = process.env.GETSUPERPOWER_BIN ?? "getsuperpower";
```

It should forward commands to the CLI:

```bash
getsuperpower loop <command> <workflow-json> [...options]
```

The installed entry skill should contain:

```text
SKILL.md
workflow.json
loop.mjs              # generated CLI bridge
loop.metadata.json    # dynamic loop discovery data
```

It should no longer contain copied generic runtime code:

```text
loop-runtime.mjs      # remove from installed output
```

The source workflow can still declare `loop` in `workflow.json`, but the loop
script path becomes the generated runner path instead of a source file that must
be authored and copied.

## Scope

In scope:

- generate `loop.mjs` from CLI-owned code during install preparation;
- stop copying `loop-runtime.mjs` into installed entry skills;
- avoid requiring workflow authors to maintain `loop.mjs` runtime logic;
- update validation semantics so the loop script path is a generated output
  path, not a required source file;
- keep `getsuperpower loop ...` as the primary execution path;
- update the grilled-product-dev example, docs, and tests.

Out of scope:

- changing run state shape or event schema;
- executing workflow phases automatically;
- removing `loop.metadata.json`;
- resolving installed workflow names without a source path;
- requiring network fallback such as `npx getsuperpower` from generated runners.

## Recommended Design

Use a generated Node bridge, not an inline runtime blob.

This keeps `loop.mjs` tiny and makes the source of truth obvious: the CLI owns
the generic loop function. The generated file is only a compatibility shim for
people who still run `node loop.mjs ...`; normal agents should continue to run
`getsuperpower loop ...` directly.

## Risks

- Direct `node loop.mjs ...` compatibility now depends on the `getsuperpower`
  CLI being available on `PATH`.
- Existing tests expect `loop-runtime.mjs` to be copied and must be updated.
- Existing workflows that include a hand-written `loop.mjs` need a clear
  migration path so validation does not fail unexpectedly.

## Approved Decisions

1. `getsuperpower validate/install` should generate `loop.mjs` entirely from
   `workflow.json`; source workflows should not need checked-in runtime code.
2. Direct `node loop.mjs ...` compatibility may require `getsuperpower` on
   `PATH`, because the CLI owns the generic loop function.
