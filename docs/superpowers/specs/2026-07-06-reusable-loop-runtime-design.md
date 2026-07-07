# Reusable Loop Runtime Design

> Superseded note: this design established the reusable Node runtime and wrapper
> compatibility. The current contract is the CLI-owned generated runner design
> in `2026-07-07-generated-loop-runner-design.md`: workflow sources declare
> `loop.script`, install generates `loop.mjs`, and installed entries no longer
> carry `loop-runtime.mjs`.

## Summary

GetSuperpower looped workflows should keep `node loop.mjs ...` as a compatibility
command while moving generic loop machinery into a shared runtime. The approved
runtime design uses a checked-in Node ESM runtime asset, a thin workflow-local
wrapper, automatic install-time runtime copying, and an internal runtime
namespace rename from `ponytrail` to `getsuperpower`.

## Approved Decisions

- Use a checked-in Node-compatible ESM runtime asset.
- Put active runtime modules under `src/runtimes/getsuperpower/`.
- Add the shared loop runtime at
  `src/runtimes/getsuperpower/workflow-loop-runtime.mjs`.
- Keep workflow-local `loop.mjs` files as thin wrappers.
- Automatically copy `loop-runtime.mjs` into installed entry skills whenever
  `workflow.json` declares `loop`.
- Add a later `getsuperpower loop ...` CLI adapter when workflow use proves the
  need.
- Keep `node loop.mjs <start|status|log|advance|summary>` as a compatibility
  contract.
- Keep unrelated legacy names, such as `ponytrail-prehook.sh`, out of this
  rename unless implementation requires touching them.

## Architecture

The runtime source layout becomes:

```text
src/runtimes/getsuperpower/
  index.ts
  workflow-bundles.ts
  instruction-context.ts
  snapshots.ts
  workflow-loop-runtime.mjs
```

`workflow-loop-runtime.mjs` owns generic runtime behavior:

- parse loop CLI arguments;
- load `workflow.json`;
- derive workflow name, steps, gates, and instructions;
- create and update global run state;
- append and read structured events;
- resolve `--run` and `--latest`;
- build action-only status payloads;
- advance sequentially or through guarded forced advancement;
- generate mechanical summaries;
- render JSON and plain text command output.

`examples/workflows/grilled-product-dev/loop.mjs` becomes a small wrapper:

```js
#!/usr/bin/env node

import { runWorkflowLoopCli } from "./loop-runtime.mjs";

await runWorkflowLoopCli({
  argv: process.argv.slice(2),
  workflowJson: new URL("./workflow.json", import.meta.url),
});
```

`src/runtimes/getsuperpower/workflow-bundles.ts` keeps manifest validation and
install preparation. When a workflow declares `loop`, it prepares the entry
skill by copying `workflow.json`, the workflow wrapper `loop.mjs`, generated
`loop.metadata.json`, and the shared `loop-runtime.mjs` asset.

## Data Flow

At runtime, the compatibility wrapper still supports:

```bash
node loop.mjs status --latest --json
```

The wrapper passes CLI args and the local `workflow.json` URL to
`runWorkflowLoopCli`. The runtime reads the manifest, resolves the run, and uses
global state under:

```text
~/.getsuperpower/runs/<workflow>/<run-id>/
```

Each run directory contains:

- `state.json` for current status, current step index, timestamps, and run id;
- `events.jsonl` for structured event history;
- `summary.md` when the `summary` command is requested.

Installed looped workflow entry skills contain:

```text
installed-entry-skill/
  SKILL.md
  workflow.json
  loop.mjs
  loop.metadata.json
  loop-runtime.mjs
```

This keeps installed loop scripts runnable with plain Node and without a source
repo checkout, Bun, TypeScript transpilation, or a globally installed
`getsuperpower` CLI.

## Error Handling

Errors stay plain and command-oriented:

- missing or invalid `workflow.json` fails before touching run state;
- duplicate run ids fail with `Run already exists: <id>`;
- `status` requires `--run <id>` or `--latest`;
- unsupported event types fail before appending an event;
- invalid metadata fails with `--metadata must be valid JSON`;
- `advance --to` requires both `--force` and `--reason`;
- install fails clearly if it cannot copy the workflow wrapper or shared runtime
  asset.

## Testing

The implementation should use TDD at these public seams:

- direct runtime tests for `runWorkflowLoopCli` with injected args, home
  directory, output, and error streams;
- Node smoke tests for
  `examples/workflows/grilled-product-dev/loop.mjs start|status|log|advance|summary`;
- install-preparation tests that verify looped entry skills receive
  `workflow.json`, `loop.mjs`, `loop.metadata.json`, and `loop-runtime.mjs`;
- compatibility tests proving non-loop workflows do not receive loop runtime
  files;
- import/path tests and docs updates for `src/runtimes/getsuperpower/`.

Final verification should include:

```bash
rtk bun test tests/workflow-bundles.test.ts tests/loop-runtime.test.ts
rtk bun run dev -- validate examples/workflows/grilled-product-dev
rtk bun run dev -- deps examples/workflows/grilled-product-dev
rtk bun run check
```

## Scope Boundaries

This design does not change loop state location, command names, manifest shape,
or the action-only v1 behavior. It does not make the loop autonomously execute
workflow phases. The CLI command is added by the follow-up CLI loop design.

The internal namespace rename is limited to active runtime modules, imports,
tests, and docs. Legacy generated hook filenames remain unchanged unless a
specific implementation dependency requires otherwise.
