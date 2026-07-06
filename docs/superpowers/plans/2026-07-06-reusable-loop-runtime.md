# Reusable Loop Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the generic loop runtime out of workflow-local `loop.mjs`, rename the active runtime namespace from `ponytrail` to `getsuperpower`, and keep installed looped workflows runnable with plain Node.

**Architecture:** Active runtime modules move from `src/runtimes/ponytrail/` to `src/runtimes/getsuperpower/`. A checked-in Node ESM asset at `src/runtimes/getsuperpower/workflow-loop-runtime.mjs` owns command/state/event behavior; workflow `loop.mjs` files become thin wrappers; install preparation copies the shared runtime asset beside the wrapper as `loop-runtime.mjs`.

**Tech Stack:** Bun tests, TypeScript runtime modules, Node ESM `.mjs` runtime asset, Commander CLI wiring through `src/getsuperpower.ts`, Zod manifest validation.

---

## File Structure

- Move: `src/runtimes/ponytrail/index.ts` -> `src/runtimes/getsuperpower/index.ts`
- Move: `src/runtimes/ponytrail/workflow-bundles.ts` -> `src/runtimes/getsuperpower/workflow-bundles.ts`
- Move: `src/runtimes/ponytrail/instruction-context.ts` -> `src/runtimes/getsuperpower/instruction-context.ts`
- Move: `src/runtimes/ponytrail/snapshots.ts` -> `src/runtimes/getsuperpower/snapshots.ts`
- Create: `src/runtimes/getsuperpower/workflow-loop-runtime.mjs`
- Modify: `src/index.ts`
- Modify: `src/getsuperpower.ts`
- Modify: `examples/workflows/grilled-product-dev/loop.mjs`
- Modify: `tests/workflow-bundles.test.ts`
- Modify: `tests/loop-runtime.test.ts`
- Modify: `tests/cli.test.ts`
- Modify: `tests/getsuperpower.test.ts`
- Modify: `tests/instruction-context.test.ts`
- Modify: `tests/snapshots.test.ts`
- Modify: `docs/architecture.md`
- Modify: `docs/workflow-author-guide.md`
- Modify: `openspec/changes/refactor-loop-runtime-reuse/tasks.md`

## Public Seams To Confirm Before Implementation

Use these seams for TDD. Do not test private helper internals directly.

- Runtime command seam: `runWorkflowLoopCli(input)` exported from `src/runtimes/getsuperpower/workflow-loop-runtime.mjs`.
- Workflow wrapper seam: `node examples/workflows/grilled-product-dev/loop.mjs ...`.
- Install preparation seam: `getPreparedWorkflowSkillInstallDependencies({ bundle })`.
- CLI install seam: `getsuperpower install <workflow> --home <dir> --agents codex`.
- Runtime namespace seam: imports from `../src/runtimes/getsuperpower/...`.

### Task 1: Rename Active Runtime Namespace

**Files:**
- Move: `src/runtimes/ponytrail/index.ts`
- Move: `src/runtimes/ponytrail/workflow-bundles.ts`
- Move: `src/runtimes/ponytrail/instruction-context.ts`
- Move: `src/runtimes/ponytrail/snapshots.ts`
- Modify: `src/index.ts`
- Modify: `src/getsuperpower.ts`
- Modify: `tests/workflow-bundles.test.ts`
- Modify: `tests/getsuperpower.test.ts`
- Modify: `tests/instruction-context.test.ts`
- Modify: `tests/snapshots.test.ts`

- [ ] **Step 1: Write the failing import-path test**

Add this test to `tests/workflow-bundles.test.ts` near the top-level `describe` block. It proves the new namespace is importable before touching implementation imports.

```ts
test("exports workflow bundle helpers from the GetSuperpower runtime namespace", async () => {
  const runtime = await import("../src/runtimes/getsuperpower/workflow-bundles");

  expect(typeof runtime.loadWorkflowBundle).toBe("function");
  expect(typeof runtime.getPreparedWorkflowSkillInstallDependencies).toBe("function");
});
```

- [ ] **Step 2: Run the focused failing test**

Run:

```bash
rtk bun test tests/workflow-bundles.test.ts --test-name-pattern "exports workflow bundle helpers"
```

Expected: FAIL because `../src/runtimes/getsuperpower/workflow-bundles` does not exist yet.

- [ ] **Step 3: Move the runtime folder**

Run the move from the worktree root:

```bash
rtk mv src/runtimes/ponytrail src/runtimes/getsuperpower
```

Then update `src/index.ts`:

```ts
export * from "./plugins";
export * from "./runtimes/getsuperpower";
export * from "./skills";
```

Update the import in `src/getsuperpower.ts`:

```ts
} from "./runtimes/getsuperpower";
```

Update test imports:

```ts
} from "../src/runtimes/getsuperpower/workflow-bundles";
```

```ts
} from "../src/runtimes/getsuperpower/instruction-context";
```

```ts
} from "../src/runtimes/getsuperpower/snapshots";
```

Update `tests/getsuperpower.test.ts` type imports:

```ts
import type { WorkflowGitCommand } from "../src/runtimes/getsuperpower/workflow-bundles";
```

- [ ] **Step 4: Run namespace tests**

Run:

```bash
rtk bun test tests/workflow-bundles.test.ts tests/getsuperpower.test.ts tests/instruction-context.test.ts tests/snapshots.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/index.ts src/getsuperpower.ts src/runtimes/getsuperpower tests/workflow-bundles.test.ts tests/getsuperpower.test.ts tests/instruction-context.test.ts tests/snapshots.test.ts
rtk git add -u src/runtimes/ponytrail
rtk git commit -m "refactor: rename getsuperpower runtime namespace"
```

### Task 2: Add A Reusable Runtime Entry Point

**Files:**
- Create: `src/runtimes/getsuperpower/workflow-loop-runtime.mjs`
- Modify: `tests/loop-runtime.test.ts`

- [ ] **Step 1: Write the failing direct-runtime test**

Add this helper import and test to `tests/loop-runtime.test.ts`.

```ts
const runtimeModule = join(
  repoRoot,
  "src",
  "runtimes",
  "getsuperpower",
  "workflow-loop-runtime.mjs",
);
const workflowJson = join(
  repoRoot,
  "examples",
  "workflows",
  "grilled-product-dev",
  "workflow.json",
);
```

```ts
test("runWorkflowLoopCli manages run state through the reusable runtime", async () => {
  const homeDir = await mkdtemp(join(tmpdir(), "loop-runtime-direct-home-"));
  const stdout: string[] = [];
  const stderr: string[] = [];

  try {
    const { runWorkflowLoopCli } = await import(pathToFileURL(runtimeModule).href);

    const exitCode = await runWorkflowLoopCli({
      argv: ["start", "--run", "direct", "--json"],
      workflowJson: pathToFileURL(workflowJson),
      cwd: repoRoot,
      homeDir,
      stdout: (value: string) => stdout.push(value),
      stderr: (value: string) => stderr.push(value),
    });

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    const payload = JSON.parse(stdout.join(""));
    expect(payload.runId).toBe("direct");
    expect(payload.step.id).toBe("grill");
    await expect(
      stat(join(homeDir, ".getsuperpower", "runs", "grilled-product-dev", "direct", "state.json")),
    ).resolves.toBeTruthy();
  } finally {
    await rm(homeDir, { recursive: true, force: true });
  }
});
```

Also add `pathToFileURL` to the imports:

```ts
import { pathToFileURL } from "node:url";
```

- [ ] **Step 2: Run the failing direct-runtime test**

Run:

```bash
rtk bun test tests/loop-runtime.test.ts --test-name-pattern "reusable runtime"
```

Expected: FAIL because `workflow-loop-runtime.mjs` does not exist.

- [ ] **Step 3: Create the reusable runtime asset**

Create `src/runtimes/getsuperpower/workflow-loop-runtime.mjs` by moving the generic logic from the current `examples/workflows/grilled-product-dev/loop.mjs`.

Use this public entrypoint at the top:

```js
import { constants } from "node:fs";
import { access, appendFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const commandNames = new Set(["start", "status", "log", "advance", "summary"]);
const eventTypes = new Set([
  "start",
  "status",
  "question",
  "answer",
  "approval",
  "phase_result",
  "error",
  "summary",
  "advance",
  "force_advance",
  "complete",
]);

export async function runWorkflowLoopCli(input = {}) {
  const stdout = input.stdout ?? ((value) => process.stdout.write(value));
  const stderr = input.stderr ?? ((value) => process.stderr.write(value));

  try {
    const parsed = parseArgs(input.argv ?? process.argv.slice(2));
    if (!parsed.command || !commandNames.has(parsed.command)) {
      throw new Error("Usage: node loop.mjs <start|status|log|advance|summary> [options]");
    }

    const manifestUrl = input.workflowJson ?? new URL("./workflow.json", import.meta.url);
    const manifestPath = fileURLToPath(manifestUrl);
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const context = {
      manifest,
      manifestPath,
      workflowDir: dirname(manifestPath),
      workflowName: manifest.name,
      runsRoot: join(input.homeDir ?? homedir(), ".getsuperpower", "runs", manifest.name),
      json: parsed.options.json === true,
      cwd: input.cwd ?? process.cwd(),
      stdout,
    };

    await runCommand(context, parsed.command, parsed.options);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr(`${message}\n`);
    return 1;
  }
}
```

Move the existing command helpers from `loop.mjs` into this file and adjust these details:

```js
async function runCommand(context, command, options) {
  switch (command) {
    case "start":
      await startRun(context, options);
      return;
    case "status":
      await showStatus(context, options);
      return;
    case "log":
      await logEventCommand(context, options);
      return;
    case "advance":
      await advanceRun(context, options);
      return;
    case "summary":
      await writeSummaryCommand(context, options);
      return;
    default:
      throw new Error(`Unknown loop command: ${command}`);
  }
}
```

```js
cwd: context.cwd,
```

```js
function writeOutput(context, payload) {
  if (context.json) {
    context.stdout(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  const lines = [];
  const step = payload.step;
  lines.push(`${payload.workflow} ${payload.runId}`);
  lines.push(`Status: ${payload.status ?? "ok"}`);
  if (step) {
    lines.push(`Step: ${step.id} - ${step.title}`);
    lines.push(`Skill: ${step.skill}`);
    lines.push(`Instruction: ${step.instruction}`);
  } else if (payload.instruction) {
    lines.push(`Instruction: ${payload.instruction}`);
  }
  if (payload.summaryPath) {
    lines.push(`Summary: ${payload.summaryPath}`);
  }
  lines.push("Actions:");
  for (const action of payload.actions ?? []) {
    lines.push(`- ${action.type}: ${action.description}`);
  }
  context.stdout(`${lines.join("\n")}\n`);
}
```

Remove the old `scriptDir()` helper from the moved runtime, because callers now pass `workflowJson`.

- [ ] **Step 4: Run the direct-runtime test**

Run:

```bash
rtk bun test tests/loop-runtime.test.ts --test-name-pattern "reusable runtime"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/runtimes/getsuperpower/workflow-loop-runtime.mjs tests/loop-runtime.test.ts
rtk git commit -m "feat: add reusable workflow loop runtime"
```

### Task 3: Reduce The Example Loop Script To A Thin Wrapper

**Files:**
- Modify: `examples/workflows/grilled-product-dev/loop.mjs`
- Modify: `tests/loop-runtime.test.ts`

- [ ] **Step 1: Write the failing thin-wrapper assertion**

Add this test to `tests/loop-runtime.test.ts`.

```ts
test("grilled-product-dev loop.mjs is a thin runtime wrapper", async () => {
  const source = await readFile(loopScript, "utf8");

  expect(source).toContain('import { runWorkflowLoopCli } from "./loop-runtime.mjs";');
  expect(source).toContain('workflowJson: new URL("./workflow.json", import.meta.url)');
  expect(source).not.toContain("function parseArgs");
  expect(source).not.toContain("function buildSummary");
  expect(source).not.toContain("function writeState");
});
```

- [ ] **Step 2: Run the failing wrapper test**

Run:

```bash
rtk bun test tests/loop-runtime.test.ts --test-name-pattern "thin runtime wrapper"
```

Expected: FAIL because the example `loop.mjs` still contains the full runtime.

- [ ] **Step 3: Replace the example loop script**

Replace `examples/workflows/grilled-product-dev/loop.mjs` with:

```js
#!/usr/bin/env node

import { runWorkflowLoopCli } from "./loop-runtime.mjs";

process.exitCode = await runWorkflowLoopCli({
  argv: process.argv.slice(2),
  workflowJson: new URL("./workflow.json", import.meta.url),
});
```

- [ ] **Step 4: Make source example runnable**

Copy the shared runtime asset into the source workflow example as `examples/workflows/grilled-product-dev/loop-runtime.mjs`.

Use this exact file content relationship:

```text
examples/workflows/grilled-product-dev/loop-runtime.mjs
```

must match:

```text
src/runtimes/getsuperpower/workflow-loop-runtime.mjs
```

The implementation can use `cp` for the initial copy, but future edits should keep the shared source as the canonical asset.

- [ ] **Step 5: Run wrapper smoke tests**

Run:

```bash
rtk bun test tests/loop-runtime.test.ts
```

Expected: PASS, including the existing Node smoke test that exercises `start`, `status`, `log`, `advance`, and `summary`.

- [ ] **Step 6: Commit**

```bash
rtk git add examples/workflows/grilled-product-dev/loop.mjs examples/workflows/grilled-product-dev/loop-runtime.mjs tests/loop-runtime.test.ts
rtk git commit -m "refactor: thin grilled workflow loop wrapper"
```

### Task 4: Copy The Shared Runtime During Install Preparation

**Files:**
- Modify: `src/runtimes/getsuperpower/workflow-bundles.ts`
- Modify: `tests/workflow-bundles.test.ts`
- Modify: `tests/cli.test.ts`

- [ ] **Step 1: Write the failing prepared-dependency test**

Add this assertion to the existing `tests/workflow-bundles.test.ts` test that covers `getPreparedWorkflowSkillInstallDependencies` for looped workflows.

```ts
const runtimeSource = await readFile(
  join(import.meta.dir, "..", "src", "runtimes", "getsuperpower", "workflow-loop-runtime.mjs"),
  "utf8",
);
await expect(readFile(join(preparedEntry.source, "loop-runtime.mjs"), "utf8")).resolves.toBe(
  runtimeSource,
);
```

If the test does not already expose `preparedEntry`, use this shape:

```ts
const prepared = await getPreparedWorkflowSkillInstallDependencies({ bundle });
const preparedEntry = prepared.dependencies.find((dependency) =>
  dependency.source.endsWith("looped-workflow"),
);
expect(preparedEntry).toBeDefined();
```

- [ ] **Step 2: Write the failing CLI install assertion**

In `tests/cli.test.ts`, inside `getsuperpower install copies loop runtime files into the installed entry skill`, add:

```ts
await expect(readFile(join(installedSkillDir, "loop-runtime.mjs"), "utf8")).resolves.toContain(
  "runWorkflowLoopCli",
);
```

- [ ] **Step 3: Run failing install-copy tests**

Run:

```bash
rtk bun test tests/workflow-bundles.test.ts tests/cli.test.ts --test-name-pattern "loop runtime"
```

Expected: FAIL because `loop-runtime.mjs` is not copied yet.

- [ ] **Step 4: Update install preparation**

In `src/runtimes/getsuperpower/workflow-bundles.ts`, add imports:

```ts
import { fileURLToPath } from "node:url";
```

Add constants near the existing workflow constants:

```ts
const workflowLoopRuntimeSourceFileName = "workflow-loop-runtime.mjs";
const installedLoopRuntimeFileName = "loop-runtime.mjs";
```

Add helper:

```ts
function getWorkflowLoopRuntimeAssetPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), workflowLoopRuntimeSourceFileName);
}
```

Inside `getPreparedWorkflowSkillInstallDependencies`, after copying `loop.mjs`, copy the shared runtime asset:

```ts
await cp(getWorkflowLoopRuntimeAssetPath(), join(preparedSkillDir, installedLoopRuntimeFileName));
```

- [ ] **Step 5: Run install-copy tests**

Run:

```bash
rtk bun test tests/workflow-bundles.test.ts tests/cli.test.ts --test-name-pattern "loop runtime"
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add src/runtimes/getsuperpower/workflow-bundles.ts tests/workflow-bundles.test.ts tests/cli.test.ts
rtk git commit -m "feat: copy loop runtime asset during install"
```

### Task 5: Preserve Non-Loop Workflow Compatibility

**Files:**
- Modify: `tests/workflow-bundles.test.ts`
- Modify: `tests/cli.test.ts` if CLI coverage needs a direct installed-skill assertion

- [ ] **Step 1: Write the non-loop prepared-dependency test**

Add this test to `tests/workflow-bundles.test.ts`.

```ts
test("does not prepare loop runtime files for non-loop workflows", async () => {
  const bundle = await loadWorkflowBundle("examples/workflows/release-review");
  const prepared = await getPreparedWorkflowSkillInstallDependencies({ bundle });

  try {
    expect(prepared.dependencies.map((dependency) => dependency.source)).toEqual(
      getWorkflowSkillInstallSources(bundle),
    );
    expect(prepared.cleanup).toBeUndefined();
  } finally {
    await prepared.cleanup?.();
  }
});
```

- [ ] **Step 2: Run the non-loop test**

Run:

```bash
rtk bun test tests/workflow-bundles.test.ts --test-name-pattern "non-loop"
```

Expected: PASS. If it fails, fix only the changed loop-preparation behavior.

- [ ] **Step 3: Run broader workflow bundle tests**

Run:

```bash
rtk bun test tests/workflow-bundles.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
rtk git add tests/workflow-bundles.test.ts
rtk git commit -m "test: preserve non-loop workflow install preparation"
```

### Task 6: Update Docs For The Renamed Runtime And Thin Loop Wrapper

**Files:**
- Modify: `docs/architecture.md`
- Modify: `docs/workflow-author-guide.md`
- Modify: `openspec/changes/refactor-loop-runtime-reuse/tasks.md`

- [ ] **Step 1: Update architecture docs**

In `docs/architecture.md`, change the source map to:

```text
src/
  cli.ts
  plugins/
    skill-installer.ts
  runtimes/
    getsuperpower/
      instruction-context.ts
      snapshots.ts
      workflow-bundles.ts
      workflow-loop-runtime.mjs
```

Replace references to:

```text
src/runtimes/ponytrail/
```

with:

```text
src/runtimes/getsuperpower/
```

Replace the compatibility sentence with:

```md
The runtime folder uses the GetSuperpower name. Older Pony Trail history,
revert, and prehook behavior remains paused and is not exposed by the public
CLI.
```

Update the install-preparation bullet to mention copied `loop-runtime.mjs`.

- [ ] **Step 2: Update author guide loop runtime section**

In `docs/workflow-author-guide.md`, update the optional loop runtime section to explain:

```md
Looped workflow `loop.mjs` files should be thin wrappers around the shared
runtime. GetSuperpower copies the shared `loop-runtime.mjs` asset into the
installed entry skill automatically when `workflow.json` declares `loop`.
```

Show the wrapper:

```js
#!/usr/bin/env node

import { runWorkflowLoopCli } from "./loop-runtime.mjs";

process.exitCode = await runWorkflowLoopCli({
  argv: process.argv.slice(2),
  workflowJson: new URL("./workflow.json", import.meta.url),
});
```

Update the installed-files sentence so it lists `workflow.json`, `loop.mjs`,
`loop.metadata.json`, and `loop-runtime.mjs`.

- [ ] **Step 3: Update OpenSpec task progress**

In `openspec/changes/refactor-loop-runtime-reuse/tasks.md`, mark these after implementation:

```md
- [x] Move active runtime modules from `src/runtimes/ponytrail/` to
      `src/runtimes/getsuperpower/` and update imports.
- [x] Update author documentation.
```

- [ ] **Step 4: Run docs/import reference scan**

Run:

```bash
rtk rg -n "src/runtimes/ponytrail|runtimes/ponytrail" src tests docs openspec README.md
```

Expected: no active source/test/docs references. Historical OpenSpec archive references may remain only if they are intentionally old archived context.

- [ ] **Step 5: Commit**

```bash
rtk git add docs/architecture.md docs/workflow-author-guide.md openspec/changes/refactor-loop-runtime-reuse/tasks.md
rtk git commit -m "docs: update loop runtime author guidance"
```

### Task 7: Final Verification And Cleanup

**Files:**
- Modify: `openspec/changes/refactor-loop-runtime-reuse/tasks.md`
- Review: all changed implementation files

- [ ] **Step 1: Run focused tests**

Run:

```bash
rtk bun test tests/workflow-bundles.test.ts tests/loop-runtime.test.ts tests/cli.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run CLI smoke checks**

Run:

```bash
rtk bun run dev -- validate examples/workflows/grilled-product-dev
rtk bun run dev -- deps examples/workflows/grilled-product-dev
node examples/workflows/grilled-product-dev/loop.mjs start --run plan-smoke --json
node examples/workflows/grilled-product-dev/loop.mjs status --run plan-smoke --json
```

Expected:

- validate prints `GetSuperpower valid: grilled-product-dev@0.1.0`;
- deps prints the workflow dependencies;
- loop start returns JSON with `runId: "plan-smoke"` and step `grill`;
- loop status returns step `grill`.

Use a temporary `HOME` for the Node smoke if avoiding real global run state is preferred:

```bash
HOME="$(mktemp -d)" node examples/workflows/grilled-product-dev/loop.mjs start --run plan-smoke --json
```

- [ ] **Step 3: Run full gate**

Run:

```bash
rtk bun run check
```

Expected: PASS.

- [ ] **Step 4: Mark verification tasks**

Update `openspec/changes/refactor-loop-runtime-reuse/tasks.md`:

```md
- [x] Run focused Bun tests for loop runtime and workflow-bundle installation.
- [x] Run Node smoke checks against the example workflow loop.
- [x] Run CLI validate/deps smoke checks for the example workflow.
- [x] Run `rtk bun run check`.
- [x] Record Pony Trail post-change evidence.
```

Leave archive pending:

```md
- [ ] Run `/opsx:archive` after human approval.
```

- [ ] **Step 5: Commit final verification state**

```bash
rtk git add openspec/changes/refactor-loop-runtime-reuse/tasks.md
rtk git commit -m "chore: record loop runtime verification"
```

## Plan Self-Review

- Spec coverage: covered reusable runtime entrypoint, thin wrapper, installed Node portability, existing command compatibility, non-loop compatibility, and runtime namespace rename.
- Placeholder scan: no unfinished markers or fill-in steps are intentionally left.
- Type consistency: source runtime path is consistently `src/runtimes/getsuperpower/`; installed runtime asset is consistently `loop-runtime.mjs`; source runtime asset is consistently `workflow-loop-runtime.mjs`.
