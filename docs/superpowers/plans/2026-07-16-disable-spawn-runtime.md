# Disable Spawn Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exclude agent spawning from the production Omniskills CLI and replace team dispatch instructions with explicit manual handoffs while preserving bundles, profile generation, and model routing.

**Architecture:** Remove dispatch dependencies from the `src/cli.ts` entry graph and from the `src/omniskill.ts` command shell, then stop exporting dormant spawn modules through public barrels. Keep the direct runtime, adapter, and run-store files plus their focused tests. Team coordinators become handoff preparers that stop before execution; install-time orchestration remains configuration-only.

**Tech Stack:** Bun 1.3, TypeScript, Commander, Bun test, Zod, Biome, Pony Trail snapshots.

---

## Scope and File Structure

The approved design is
`docs/superpowers/specs/2026-07-16-disable-spawn-runtime-design.md`.

Production CLI boundary:

- Modify `src/cli.ts` — stop importing and constructing the Codex dispatcher.
- Modify `src/omniskill.ts` — remove dispatch dependency injection, dormant
  command handlers, resume handlers, and dispatch-only imports.
- Modify `src/plugins/index.ts` — stop publicly re-exporting the dormant
  dispatcher and run store.
- Modify `src/runtimes/omniskill/index.ts` — stop publicly re-exporting the
  dormant dispatch runtime.
- Create `tests/cli-bundle.test.ts` — prove a fresh production bundle excludes
  spawn markers and the production entry sources contain no spawn imports.
- Modify `tests/omniskill.test.ts` — remove skipped command-level rollback tests
  that target a command which no longer exists; retain direct runtime, adapter,
  and run-store suites.

Coordinator boundary:

- Modify `examples/teams/startup-team/skills/startup-goal/SKILL.md` — replace
  dispatch with prepared manual handoffs.
- Modify `examples/teams/finance-team/skills/finance-research/SKILL.md` — replace
  parallel verified dispatch with prepared manual research handoffs.
- Modify `examples/teams/market-team/skills/market-research/SKILL.md` — replace
  parallel verified dispatch with prepared manual research handoffs.
- Modify the matching three team `README.md` files — remove runnable dispatch
  and resume examples and explain the manual-execution boundary.
- Modify `tests/workflow-bundles.test.ts` — pin the spawn-free coordinator
  contract.
- Modify `tests/readme.test.ts` — pin spawn-free public team documentation.
- Modify `docs/architecture.md` — distinguish retained configuration from
  excluded execution.

The finance and market team directories are currently untracked, and several
tracked files already contain user-owned changes. Never stage an entire dirty
file merely to satisfy a commit step. Use Pony Trail before each mutation,
inspect the staged diff, and commit only an exactly isolated patch. If an exact
patch cannot be isolated from the existing work, leave that slice unstaged and
report it instead of absorbing the earlier work.

### Task 1: Exclude Spawn Modules From the Production CLI Graph

**Files:**

- Create: `tests/cli-bundle.test.ts`
- Modify: `src/cli.ts:14-24,70-78`
- Modify: `src/omniskill.ts:1-65,177-192,214-236,270-280,399-797`
- Modify: `src/plugins/index.ts:1-6`
- Modify: `src/runtimes/omniskill/index.ts:1-3`
- Modify: `tests/omniskill.test.ts:1-20,724-1794`
- Preserve: `src/runtimes/omniskill/orchestration-dispatch.ts`
- Preserve: `src/plugins/orchestration-dispatcher.ts`
- Preserve: `src/plugins/orchestration-run-store.ts`
- Preserve: `tests/orchestration-dispatch.test.ts`
- Preserve: `tests/orchestration-dispatcher.test.ts`
- Preserve: `tests/orchestration-run-store.test.ts`

- [ ] **Step 1: Snapshot the production-boundary files before mutation**

Run:

```bash
rtk sh /Users/roy/.agents/skills/pony-trail/scripts/snapshot_change.sh \
  --session-id disable-spawn-runtime \
  pre \
  --files tests/cli-bundle.test.ts src/cli.ts src/omniskill.ts src/plugins/index.ts src/runtimes/omniskill/index.ts tests/omniskill.test.ts \
  --action "exclude spawn runtime from production CLI" \
  --purpose "Prevent normal CLI startup and builds from loading dispatcher, resume, and run-store code" \
  --reason "The public command is disabled but the entry graph still imports and constructs the dispatcher" \
  --expected "The built CLI contains no spawn markers while direct dormant modules remain testable" \
  --verify "Run the bundle contract test, typecheck, focused CLI tests, and direct dormant runtime tests" \
  --rollback "Restore the six files from the pre snapshot or revert the isolated implementation commit"
```

Save the emitted snapshot ID for Step 7.

- [ ] **Step 2: Write the failing production-bundle contract test**

Create `tests/cli-bundle.test.ts` with this complete test:

```typescript
import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..");

describe("production CLI spawn boundary", () => {
  test("excludes dormant dispatch modules from source entrypoints and the built bundle", async () => {
    const sourceContracts = [
      {
        path: "src/cli.ts",
        forbidden: ["createCodexCliDispatcher", "dispatchers:"],
      },
      {
        path: "src/omniskill.ts",
        forbidden: [
          "OrchestrationDispatcher",
          "createOrchestrationRunStore",
          "_configureDispatchCommand",
          "runOmniskillDispatchResume",
        ],
      },
      {
        path: "src/plugins/index.ts",
        forbidden: ["./orchestration-dispatcher", "./orchestration-run-store"],
      },
      {
        path: "src/runtimes/omniskill/index.ts",
        forbidden: ["./orchestration-dispatch"],
      },
    ];

    for (const contract of sourceContracts) {
      const source = await readFile(join(repoRoot, contract.path), "utf8");
      for (const forbidden of contract.forbidden) {
        expect(source).not.toContain(forbidden);
      }
    }

    const outputDir = await mkdtemp(join(tmpdir(), "omniskill-cli-bundle-"));
    const outputPath = join(outputDir, "cli.js");
    try {
      const build = Bun.spawn(
        ["bun", "build", "--target=node", `--outfile=${outputPath}`, "src/cli.ts"],
        { cwd: repoRoot, stdout: "pipe", stderr: "pipe" },
      );
      const exitCode = await build.exited;
      expect(exitCode).toBe(0);

      const bundle = await readFile(outputPath, "utf8");
      for (const forbidden of [
        "createCodexCliDispatcher",
        "DispatchAdapterSchema",
        "DispatchRuntimeSchema",
        "ConsultationDecisionSchema",
      ]) {
        expect(bundle).not.toContain(forbidden);
      }
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 3: Run the new test and verify the red state**

Run:

```bash
rtk bun test tests/cli-bundle.test.ts
```

Expected: FAIL because `src/cli.ts` still contains
`createCodexCliDispatcher`, `src/omniskill.ts` still contains the dormant
command implementation, and the temporary bundle still contains dispatch
schemas. The current pre-change bundle is approximately 0.78 MB and contains
`DispatchRuntimeSchema`, `ConsultationDecisionSchema`,
`DispatchAdapterSchema`, and `createCodexCliDispatcher`.

- [ ] **Step 4: Remove dispatcher construction from `src/cli.ts`**

Change the plugin import to contain only supported production dependencies:

```typescript
import {
  createCodexModelCatalogProvider,
  installAgentSkill,
  parseSkillInstallAgents,
  type SkillInstallResult,
} from "./plugins";
```

Change `configureOmniskillCommand` construction to:

```typescript
configureOmniskillCommand(program, {
  rootDir,
  installSkill,
  printSkillInstallResult,
  installExternalSkillDependency,
  codexModelCatalog: createCodexModelCatalogProvider(runSubprocess),
});
```

Do not replace the dispatcher with lazy loading, a feature flag, or another
spawn API.

- [ ] **Step 5: Remove command-level spawn code from `src/omniskill.ts`**

Remove these dispatch-only imports from `./plugins`:

```typescript
createOrchestrationRunStore
type OrchestrationDispatcher
type OrchestrationRunStore
```

Remove these dispatch-only imports from `./runtimes/omniskill`:

```typescript
type ConsultationDecision
ConsultationDecisionSchema
type ConsultationRequest
createDispatchAttemptSchedule
type DispatchAttempt
type DispatchCapability
type DispatchReceipt
type DispatchRequest
DispatchRuntimeSchema
hasRepeatedConsultationEvidence
loadInstalledWorkflowBundle
planOrchestrationDispatch
```

Remove `readFile` from `node:fs/promises`; dispatch is its only caller in this
file. Keep `runSubprocess` because onboarding still uses it.

Delete these option types and dependency-injection fields:

```typescript
interface OmniskillDispatchCommandOptions {
  role?: string;
  task?: string;
  taskFile?: string;
  runtime: string;
  home: string;
  dir?: string;
  approveWorkspaceWrite: boolean;
  dryRun: boolean;
  json: boolean;
}

interface OmniskillDispatchResumeCommandOptions {
  decision: string;
  message: string;
  role?: string;
  home: string;
  dir?: string;
  json: boolean;
}

// From ConfigureOmniskillCommandOptions:
dispatchers?: Partial<Record<"codex" | "claude", OrchestrationDispatcher>>;
createRunStore?: (homeDir: string) => OrchestrationRunStore;
```

Delete these functions in full:

```typescript
getDispatcherCapability
_configureDispatchCommand
runOmniskillDispatchResume
printDispatchReceipt
```

Do not change `configureOmniskillCommands`; it already omits dispatch. Do not
change `configureModelRoutingCommand`, `configureInstallCommand`,
`runOmniskillInstall`, `orchestrationTargets`, or profile planning.

- [ ] **Step 6: Make dormant modules direct-import only and remove obsolete command tests**

Make `src/plugins/index.ts` exactly omit these two exports while retaining all
other exports:

```typescript
export * from "./agent-profile-installer";
export * from "./codex-model-catalog";
export * from "./model-routing-setup";
export * from "./skill-installer";
```

Remove this line from `src/runtimes/omniskill/index.ts`:

```typescript
export * from "./orchestration-dispatch";
```

Keep the orchestration profile and workflow-bundle exports.

In `tests/omniskill.test.ts`, remove `createOrchestrationRunStore` from the
plugin import. Delete the complete skipped dispatch-command block starting at:

```text
// Retained for rollback while the public dispatch command remains disabled.
test.skip("dispatch dry-run prints a verified plan without launching or writing run state"
```

and ending immediately before:

```text
test("bootstraps a missing repo-backed role and verifies its installed name"
```

Do not delete the direct runtime, adapter, or run-store test files named in the
preserve list above.

- [ ] **Step 7: Run focused green checks and record the post snapshot**

Run:

```bash
rtk bun test tests/cli-bundle.test.ts tests/cli.test.ts tests/omniskill.test.ts tests/orchestration-dispatch.test.ts tests/orchestration-dispatcher.test.ts tests/orchestration-run-store.test.ts
rtk bun run typecheck
```

Expected: all focused tests PASS with zero failures, the direct dormant-module
tests still run, and TypeScript reports no removed option/import references.

Record the post snapshot using the ID from Step 1:

```bash
SPAWN_BOUNDARY_SNAPSHOT_ID="$(rtk jq -r 'select(.session_id == "disable-spawn-runtime" and .phase == "pre" and .action == "exclude spawn runtime from production CLI") | .snapshot_id' .getsuperpower/snapshots.jsonl | rtk tail -n 1)"
rtk sh /Users/roy/.agents/skills/pony-trail/scripts/snapshot_change.sh \
  --session-id disable-spawn-runtime \
  post \
  --snapshot-id "$SPAWN_BOUNDARY_SNAPSHOT_ID" \
  --files tests/cli-bundle.test.ts src/cli.ts src/omniskill.ts src/plugins/index.ts src/runtimes/omniskill/index.ts tests/omniskill.test.ts \
  --summary "Removed production dispatcher wiring and command handlers while retaining direct dormant modules" \
  --checks "Focused bundle, CLI, Omniskill, dispatch-runtime, dispatcher, run-store tests; typecheck" \
  --result "pass"
```

- [ ] **Step 8: Commit only an isolated production-boundary patch**

Inspect before staging:

```bash
rtk proxy git diff -- src/cli.ts src/omniskill.ts src/plugins/index.ts src/runtimes/omniskill/index.ts tests/omniskill.test.ts tests/cli-bundle.test.ts
```

Stage only the new test and exact spawn-removal hunks. Do not use a whole-file
`git add` for a file that contains earlier user changes. Verify the staged tree:

```bash
rtk proxy git diff --cached --check
rtk proxy git diff --cached --stat
rtk proxy git diff --cached
```

Expected: only the production spawn boundary and its regression test are
staged. Then commit:

```bash
rtk git commit -m "fix: exclude spawn runtime from cli bundle"
```

If exact isolation is impossible, leave the slice unstaged and report why.

### Task 2: Replace Team Dispatch With Manual Handoffs

**Files:**

- Modify: `tests/workflow-bundles.test.ts:1720-1795,2090-2140`
- Modify: `tests/readme.test.ts:72-91,136-151`
- Modify: `examples/teams/startup-team/skills/startup-goal/SKILL.md:35-105`
- Modify: `examples/teams/startup-team/README.md:70-121`
- Modify: `examples/teams/finance-team/skills/finance-research/SKILL.md:25-62`
- Modify: `examples/teams/finance-team/README.md:18-27`
- Modify: `examples/teams/market-team/skills/market-research/SKILL.md:25-64`
- Modify: `examples/teams/market-team/README.md:18-27`
- Modify: `docs/architecture.md:42-48,137-146`

- [ ] **Step 1: Snapshot coordinator, documentation, and contract-test files**

Run a Pony Trail pre snapshot over the nine files above. Use:

```text
action: replace automatic team dispatch with manual handoffs
purpose: keep team bundles useful without launching role agents
reason: coordinator skills still require commands that are unavailable and excluded from the shipped CLI
expected: all coordinators prepare role briefs, mark them unexecuted, and stop
verify: focused workflow-bundle and README tests plus literal forbidden-command scan
rollback: restore the nine files from the pre snapshot or revert the isolated coordinator commit
```

Save the emitted snapshot ID for Step 6.

- [ ] **Step 2: Write the failing coordinator contract tests**

In `tests/workflow-bundles.test.ts`, define the shared contract near the startup
role helpers:

```typescript
const manualHandoffContracts = [
  {
    team: "startup-team",
    skill: "startup-goal",
  },
  {
    team: "finance-team",
    skill: "finance-research",
  },
  {
    team: "market-team",
    skill: "market-research",
  },
] as const;
```

Add this test in the workflow-bundle example describe block:

```typescript
test("team coordinators prepare manual handoffs without spawning roles", async () => {
  for (const contract of manualHandoffContracts) {
    const skill = await readFile(
      join(
        import.meta.dir,
        "..",
        "examples",
        "teams",
        contract.team,
        "skills",
        contract.skill,
        "SKILL.md",
      ),
      "utf8",
    );

    expect(skill).toContain("Automatic role launch is disabled");
    expect(skill).toContain("Prepared, not executed");
    expect(skill).toContain("Stop after presenting the handoffs");
    expect(skill).not.toContain("omniskill dispatch");
    expect(skill).not.toContain("dispatch resume");
    expect(skill).not.toContain("spawn_agent");
    expect(skill).not.toContain("launch_configured");
  }
});
```

Update the existing startup coordinator assertions:

```typescript
for (const heading of [
  "## 1. Clarify",
  "## 2. Approve",
  "## 3. Route",
  "## 4. Prepare handoffs",
  "## 5. Combine",
]) {
  expect(skill).toContain(heading);
}
expect(skill).toContain("one material question at a time");
expect(skill).toContain("explicit approval");
expect(skill).toContain("smallest safe role set");
expect(skill).toContain("Prepared, not executed");
expect(skill).toContain("accountable decision log");
expect(skill).not.toContain("omniskill dispatch");
expect(skill).not.toContain("spawn_agent");
```

Remove obsolete expectations for adapter, evidence capability, receipts,
runtime model disclosure, subagent launch, and dispatching `implement`.

In `tests/readme.test.ts`, replace the dispatch/receipt test with:

```typescript
test("documents manual startup-team execution while preserving configuration", () => {
  const readme = readRepoFile("examples/teams/startup-team/README.md");

  for (const contract of [
    "Automatic role launch is disabled",
    "Prepared, not executed",
    "../../workflows/setup-model-routing/skills/setup-model-routing",
    "examples/workflows/setup-model-routing",
    "omniskill remove startup-team",
  ]) {
    expect(readme).toContain(contract);
  }
  expect(readme).not.toContain("omniskill dispatch");
  expect(readme).not.toContain("dispatch resume");
  expect(readme).not.toContain(".omniskills/runs/");
});
```

Extend the professional research-team documentation test:

```typescript
for (const team of ["finance-team", "market-team"]) {
  const readme = readRepoFile(`examples/teams/${team}/README.md`);
  expect(readme).toContain("Automatic role launch is disabled");
  expect(readme).toContain("Prepared, not executed");
  expect(readme).not.toContain("omniskill dispatch");
  expect(readme).not.toContain("launch_configured");
}
```

- [ ] **Step 3: Run the coordinator contracts and verify the red state**

Run:

```bash
rtk bun test tests/workflow-bundles.test.ts -t "team coordinators prepare manual handoffs without spawning roles"
rtk bun test tests/readme.test.ts -t "manual startup-team execution"
```

Expected: FAIL because all three coordinator skills and READMEs still instruct
verified dispatch and do not contain the manual-handoff markers.

- [ ] **Step 4: Replace each coordinator's dispatch phase**

In the startup coordinator, change the route approval sentence to:

```markdown
Present the route plan and wait for explicit approval before preparing handoffs.
```

Replace `## 4. Dispatch` and `## Orchestration policy` with:

```markdown
## 4. Prepare handoffs

Automatic role launch is disabled. Do not call a dispatch command or any other
agent-launch API.

For every selected role, prepare a handoff containing the matching role skill,
goal, current task, prior handoff, expected output, approval gate, constraints,
and verification bar. Label every handoff `Prepared, not executed`.

When `founding-engineer` is selected, prepare its implementation frame as a
read-only handoff. Prepare a separate `implement` execution handoff and a final
`qa-lead` verification handoff, but do not execute any of them.

Stop after presenting the handoffs. Continue only when the user supplies
completed role outputs in a later interaction. A prepared handoff is not
evidence that a role ran.

## Manual execution policy

Do not disclose a runtime, model, effort, adapter, evidence capability,
receipt, or run ID because no launch occurred. Human approval of a route
authorizes handoff preparation only; it does not authorize automatic execution.
```

Change startup `## 5. Combine` so it begins:

```markdown
Combine only completed role outputs that the user supplies in a later interaction.
```

For finance and market coordinators, replace `## 4. Dispatch` with the same
automatic-launch prohibition and handoff markers. Each selected specialist gets
a source policy, current research question, expected artifact, limitations, and
verification bar. Label it `Prepared, not executed`, then stop. In `## 5.
Combine`, combine only later user-supplied outputs; prepare the risk-analysis
handoff but do not execute it.

Do not leave any of these literals in a coordinator skill:

```text
omniskill dispatch
dispatch resume
spawn_agent
launch_configured
receipt run id
```

- [ ] **Step 5: Update team READMEs and architecture documentation**

Replace the startup README's preflight/execute/resume section with:

```markdown
Automatic role launch is disabled. The coordinator selects roles and prepares
manual briefs labeled `Prepared, not executed`, then stops. Run those briefs in
separate user-controlled tasks and return completed outputs to `$startup-goal`
for combination.

Installation still creates managed Codex and Claude profiles and preserves
model-role configuration. Profile generation does not launch a role or create
run state.
```

Keep the model-routing setup references, profile namespace/removal behavior,
and `omniskill remove startup-team --home ~ --dry-run` example. Remove all
dispatch, resume, receipt, adapter, and launch-evidence text.

Replace the final dispatch paragraph in each research-team README with:

```markdown
Automatic role launch is disabled. The coordinator prepares approved research
briefs labeled `Prepared, not executed` and stops. Run those briefs in separate
user-controlled tasks, then return the completed outputs for synthesis.
```

In `docs/architecture.md`, replace the temporary registration-only statement
with a production-bundle statement:

```markdown
Agent launch is disabled and excluded from the production CLI dependency graph
because the execution path can cause increasing memory usage. Workflow and team
bundles, generated profile metadata, and `setup-model-routing` remain available.
Existing dispatch run files are preserved but cannot be started or resumed
through the CLI.
```

Replace the dormant-runtime paragraph with:

```markdown
The dispatch runtime, Codex adapter, and run-store source files remain in the
repository for rollback and diagnosis. Production barrel files do not export
them, and the shipped CLI does not import them. Direct focused tests preserve
their behavior without making agent launch available.
```

- [ ] **Step 6: Run focused green checks and record the post snapshot**

Run:

```bash
rtk bun test tests/workflow-bundles.test.ts tests/readme.test.ts
rtk rg -n "omniskill dispatch|dispatch resume|spawn_agent|launch_configured" examples/teams/startup-team/skills/startup-goal/SKILL.md examples/teams/finance-team/skills/finance-research/SKILL.md examples/teams/market-team/skills/market-research/SKILL.md examples/teams/startup-team/README.md examples/teams/finance-team/README.md examples/teams/market-team/README.md
```

Expected: both test files PASS. `rg` exits 1 with no matches. Record the Pony
Trail post snapshot using the ID from Step 1 and list both focused commands as
passing checks.

- [ ] **Step 7: Commit only isolatable coordinator-contract changes**

Inspect the exact diff first:

```bash
rtk proxy git diff -- tests/workflow-bundles.test.ts tests/readme.test.ts examples/teams/startup-team/skills/startup-goal/SKILL.md examples/teams/startup-team/README.md examples/teams/finance-team/skills/finance-research/SKILL.md examples/teams/finance-team/README.md examples/teams/market-team/skills/market-research/SKILL.md examples/teams/market-team/README.md docs/architecture.md
```

Stage only exact spawn-contract hunks from tracked files. The finance and market
team directories are untracked; do not add their entire files solely for this
change. Leave those working-tree edits unstaged unless the owning team change
has explicitly staged their full baseline.

Verify `git diff --cached` contains no landing, manifest, model-routing, or
unrelated team content. If an isolated patch exists, commit it:

```bash
rtk git commit -m "docs: replace team spawning with manual handoffs"
```

Otherwise leave the slice unstaged and report the dirty-worktree dependency.

### Task 3: Verify the Disabled-Spawn Release Boundary

**Files:**

- Verify: `dist/cli.js`
- Verify: `examples/teams/startup-team`
- Verify: all files changed by Tasks 1 and 2

- [ ] **Step 1: Run focused behavior and type checks**

Run:

```bash
rtk bun test tests/cli-bundle.test.ts tests/cli.test.ts tests/omniskill.test.ts tests/workflow-bundles.test.ts tests/readme.test.ts tests/orchestration-dispatch.test.ts tests/orchestration-dispatcher.test.ts tests/orchestration-run-store.test.ts
rtk bun run typecheck
```

Expected: zero failures. Public CLI tests reject dispatch; direct dormant-module
tests remain green; coordinator tests require manual handoffs.

- [ ] **Step 2: Build and inspect the production artifact**

Run:

```bash
rtk bun run build
rtk rg -n "createCodexCliDispatcher|DispatchAdapterSchema|DispatchRuntimeSchema|ConsultationDecisionSchema|Orchestration dispatch" dist/cli.js
```

Expected: build exits 0. `rg` exits 1 with no forbidden markers.

- [ ] **Step 3: Smoke the public CLI and preserved bundle paths**

Run:

```bash
rtk bun run dev -- --help
rtk bun run dev -- dispatch
rtk bun run dev -- validate examples/teams/startup-team
rtk bun run dev -- install examples/teams/startup-team --dry-run
```

Expected:

- root help contains `install` and `setup-model-routing` but not `dispatch`;
- invoking `dispatch` exits nonzero with Commander's unknown/excess-command
  error before any runtime launch;
- startup-team validation succeeds;
- install dry-run prints skill and Codex/Claude profile plans and creates no
  dispatch run or child process.

If the install dry-run needs the signed-in Codex model catalog and the sandbox
blocks that read-only CLI call, rerun only that smoke command with the required
approval. Do not replace it with a network mock.

- [ ] **Step 4: Run the full repository gate**

Run:

```bash
rtk bun run check
```

Expected: Biome, TypeScript, all Bun tests, and the 90% line-coverage gate pass.
The previous ten skipped command-dispatch tests no longer exist; direct dormant
runtime tests still contribute coverage.

- [ ] **Step 5: Inspect final scope and commit any remaining isolatable hunks**

Run:

```bash
rtk git status --short
rtk proxy git diff --check
rtk proxy git diff --cached --check
rtk proxy git diff --cached --stat
```

Expected: no whitespace errors and no unrelated staged files. Commit only an
exact remaining spawn-disable patch. Leave pre-existing landing, team, model
routing, and other user changes untouched and unstaged.

- [ ] **Step 6: Report verification evidence**

Report:

- production bundle size before and after;
- forbidden marker scan result;
- public help and rejected-dispatch result;
- startup-team validation and install dry-run result;
- focused and full test counts;
- coverage percentage;
- dormant direct-module tests retained;
- exact implementation commit hashes, if safely created; and
- any coordinator edits left unstaged because they overlap user-owned work.
