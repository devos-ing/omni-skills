# Orchestration Dispatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an enforceable Codex dispatch plane that launches installed managed orchestration profiles, records truthful launch evidence, and fails closed when profile selection cannot be proved.

**Architecture:** Keep profile selection, approval gates, candidate order, evidence evaluation, and receipt transitions in a pure Omniskills runtime module. Put Codex subprocess arguments and JSONL event classification behind a plugin adapter, and put atomic run-state writes behind a separate store plugin. Expose both through a thin `omniskill dispatch` command; generic `spawn_agent` is never treated as verified dispatch.

**Tech Stack:** Bun, TypeScript, Zod, Commander, Node child processes and filesystem APIs, Bun test, Biome.

**Design specification:** `docs/superpowers/specs/2026-07-15-orchestration-dispatch-design.md`

---

## Scope and execution rules

- Use `rtk` for every repository command.
- Follow vertical-slice TDD: one failing public-seam test, minimal production behavior, then green.
- Use Pony Trail pre/post snapshots for every file mutation group.
- Do not write to the user's real home during deterministic tests or smoke checks.
- Do not add a Claude launcher until a local Claude CLI contract is available and tested.
- Do not invoke a shell; subprocesses receive an executable, argument array, bounded stdin, cwd, and environment.
- Treat legacy profile artifacts without dispatch metadata as non-dispatchable and tell the user to reinstall.
- Commit each task independently and stage only the named files.

## Agreed public test seams

1. `planOrchestrationDispatch` — pure selection, ownership, access, evidence, and candidate behavior.
2. `OrchestrationDispatcher` — runtime capability, argument construction, JSONL classification, and mismatch handling.
3. `omniskill dispatch` — dry-run, execution, JSON output, receipts, retry limits, approvals, and consultation resume.

## Planned file structure

### New files

- `src/runtimes/omniskill/orchestration-dispatch.ts` — request/plan/receipt schemas, typed failures, selection, retry progression, and consultation transitions.
- `src/plugins/orchestration-dispatcher.ts` — Codex capability and subprocess adapter.
- `src/plugins/orchestration-run-store.ts` — atomic request, plan, attempt, and receipt persistence.
- `tests/orchestration-dispatch.test.ts` — pure planner and state-machine behavior.
- `tests/orchestration-dispatcher.test.ts` — injected Codex process behavior.
- `tests/orchestration-run-store.test.ts` — temporary-home run-state lifecycle.

### Modified files

- `src/process.ts` — optional bounded stdin for non-shell child processes.
- `src/runtimes/omniskill/orchestration.ts` — expose generated developer instructions as profile metadata.
- `src/runtimes/omniskill/workflow-bundles.ts` — persist optional dispatch instructions in profile artifacts.
- `src/runtimes/omniskill/index.ts` — export dispatch runtime.
- `src/plugins/agent-profile-installer.ts` — record dispatch instructions.
- `src/plugins/index.ts` — export dispatcher and run store.
- `src/omniskill.ts` — register and execute `dispatch` and `dispatch resume`.
- `src/cli.ts` — inject the default Codex adapter only.
- `tests/orchestration.test.ts` — generated instruction metadata.
- `tests/agent-profile-installer.test.ts` — recorded metadata.
- `tests/omniskill.test.ts` — command behavior.
- `tests/cli.test.ts` — root command registration.
- `examples/teams/startup-team/skills/startup-goal/SKILL.md` — require verified dispatch preflight.
- `examples/teams/startup-team/README.md` — operator commands and evidence semantics.
- `docs/architecture.md` — dispatch runtime/plugin ownership.

## Task 1: Persist dispatchable profile metadata

**Files:**

- Modify: `src/runtimes/omniskill/orchestration.ts`
- Modify: `src/runtimes/omniskill/workflow-bundles.ts`
- Modify: `src/plugins/agent-profile-installer.ts`
- Test: `tests/orchestration.test.ts`
- Test: `tests/agent-profile-installer.test.ts`

- [ ] **Step 1: Write the failing metadata assertions**

Extend the deterministic profile test:

```ts
const cto = profiles.find(
  ({ source, target }) => source === "catalog:cto" && target === "codex",
);
expect(cto?.instructions).toContain("load and follow the installed `$cto` skill");
expect(cto?.instructions).toContain("Operate read-only");
expect(cto?.consultation).toBe("request");
expect(cto?.limits).toEqual(DEFAULT_ORCHESTRATION_CONFIG.limits);
```

Extend the installer artifact assertion:

```ts
expect(artifacts[0]).toEqual(
  expect.objectContaining({
    kind: "agent_profile",
    instructions: expect.stringContaining("catalog:cto agent"),
    consultation: "request",
    limits: DEFAULT_ORCHESTRATION_CONFIG.limits,
  }),
);
```

- [ ] **Step 2: Run the focused tests and confirm red**

Run:

```bash
rtk bun test tests/orchestration.test.ts tests/agent-profile-installer.test.ts
```

Expected: FAIL because `PlannedAgentProfile` and its installed artifact do not expose `instructions`.

- [ ] **Step 3: Add the dispatch metadata**

Add the field to `PlannedAgentProfile`:

```ts
export interface PlannedAgentProfile {
  source: string;
  taskClass: "role" | "support";
  profileId: string;
  target: AgentProfileTarget;
  tier: OrchestrationTier;
  model: string;
  effort: string;
  access: "read-only" | "workspace-write";
  instructions: string;
  consultation: "receive" | "request" | "none";
  limits: OrchestrationConfig["limits"];
  candidateIndex: number;
  candidateCount: number;
  destination: string;
  content: string;
  contentHash: string;
}
```

Set `instructions: developerInstructions`, `consultation: assignment.consultation`,
and `limits: input.config.limits` when planning profiles. Add these optional
legacy-compatible fields to `WorkflowInstallAgentProfileArtifact`:

```ts
instructions?: string;
consultation?: "receive" | "request" | "none";
limits?: {
  retryPerCandidate: number;
  reassignmentPerWorkItem: number;
  consultationsPerAgent: number;
};
```

Include it when `preflightAgentProfiles` creates the artifact:

```ts
instructions: profile.instructions,
consultation: profile.consultation,
limits: profile.limits,
```

- [ ] **Step 4: Run the focused tests and typecheck**

Run:

```bash
rtk bun test tests/orchestration.test.ts tests/agent-profile-installer.test.ts
rtk bun run typecheck
```

Expected: both commands exit zero.

- [ ] **Step 5: Commit the profile metadata slice**

```bash
rtk git add src/runtimes/omniskill/orchestration.ts src/runtimes/omniskill/workflow-bundles.ts src/plugins/agent-profile-installer.ts tests/orchestration.test.ts tests/agent-profile-installer.test.ts
rtk git commit -m "feat: record orchestration dispatch metadata"
```

## Task 2: Build the pure dispatch planner

**Files:**

- Create: `src/runtimes/omniskill/orchestration-dispatch.ts`
- Modify: `src/runtimes/omniskill/index.ts`
- Create: `tests/orchestration-dispatch.test.ts`

- [ ] **Step 1: Write the failing planner test**

Create a fixture containing one primary Codex CTO artifact and assert the public seam:

```ts
test("plans verified read-only dispatch from the installed artifact", async () => {
  const planSet = await planOrchestrationDispatch({
    workflow: installedWorkflow,
    role: "catalog:cto",
    runtime: "codex",
    task: "Review the service boundary.",
    cwd: "/tmp/project",
    homeDir: "/tmp/home",
    approveWorkspaceWrite: false,
    readProfile: async () => profileContent,
    capabilities: { codex: true, claude: false },
  });

  expect(planSet.primary).toEqual(
    expect.objectContaining({
      profileId: "omniskills-startup-team-cto",
      tier: "deep",
      model: "gpt-5.6",
      effort: "high",
      access: "read-only",
      evidenceRequired: "launch_configured",
    }),
  );
});
```

Add cases that expect typed codes for `profile_not_found`,
`profile_ambiguous`, `profile_path_invalid`, `profile_drifted`,
`runtime_unavailable`, `approval_required`, and legacy missing instructions.

- [ ] **Step 2: Run the test and confirm red**

```bash
rtk bun test tests/orchestration-dispatch.test.ts
```

Expected: FAIL because the dispatch runtime does not exist.

- [ ] **Step 3: Implement schemas, typed errors, and primary selection**

Create these public types:

```ts
export const DispatchRuntimeSchema = z.enum(["codex", "claude"]);
export const DispatchEvidenceLevelSchema = z.enum([
  "requested",
  "launch_configured",
  "runtime_reported",
]);

export const MAX_DISPATCH_TASK_BYTES = 64 * 1024;

export const ConsultationRequestSchema = z.object({
  type: z.literal("consultation_request"),
  trigger: z.enum([
    "ambiguity",
    "requirement_conflict",
    "elevated_risk",
    "failed_verification",
  ]),
  current_task: z.string().min(1),
  evidence: z.array(z.string().min(1)).min(1),
  decision_needed: z.string().min(1),
  recommendation: z.string().min(1),
}).strict();

export const ConsultationDecisionSchema = z.enum([
  "continue",
  "retry",
  "reassign",
  "escalate-to-human",
]);

export type ConsultationRequest = z.infer<typeof ConsultationRequestSchema>;
export type ConsultationDecision = z.infer<typeof ConsultationDecisionSchema>;

export class OrchestrationDispatchError extends Error {
  constructor(
    public readonly code:
      | "workflow_not_installed"
      | "profile_not_found"
      | "profile_ambiguous"
      | "profile_path_invalid"
      | "profile_drifted"
      | "profile_missing_dispatch_metadata"
      | "runtime_unavailable"
      | "approval_required",
    message: string,
  ) {
    super(message);
    this.name = "OrchestrationDispatchError";
  }
}

export interface DispatchRequest {
  workflow: string;
  role: string;
  task: string;
  cwd: string;
  homeDir: string;
  runtime: "codex" | "claude";
  approveWorkspaceWrite: boolean;
}

export interface DispatchPlan {
  workflow: string;
  role: string;
  task: string;
  cwd: string;
  profileId: string;
  profilePath: string;
  profileHash: string;
  runtime: "codex" | "claude";
  tier: "deep" | "standard" | "fast";
  model: string;
  effort: string;
  access: "read-only" | "workspace-write";
  instructions: string;
  consultation: "receive" | "request" | "none";
  limits: {
    retryPerCandidate: number;
    reassignmentPerWorkItem: number;
    consultationsPerAgent: number;
  };
  candidateIndex: number;
  candidateCount: number;
  evidenceRequired: "launch_configured";
  workspaceWriteApproved: boolean;
}

export interface DispatchPlanSet {
  primary: DispatchPlan;
  candidates: DispatchPlan[];
}

export interface DispatchAttempt {
  attemptNumber: number;
  candidateIndex: number;
  profileId: string;
  model: string;
  status: "completed" | "failed" | "consultation_required";
  evidence: "launch_configured" | "runtime_reported";
  sessionId?: string;
  failureCode?: string;
  failureReason?: string;
  fallbackFromAttempt?: number;
}

export interface DispatchReceipt {
  schemaVersion: "0.1";
  runId: string;
  workflow: string;
  role: string;
  profileId: string;
  profileHash: string;
  runtime: "codex" | "claude";
  tier: "deep" | "standard" | "fast";
  model: string;
  effort: string;
  access: "read-only" | "workspace-write";
  evidence: "requested" | "launch_configured" | "runtime_reported";
  adapter: "codex-cli";
  status: "planned" | "completed" | "failed" | "consultation_required";
  consultationCount: number;
  reassignmentCount: number;
  sessionId?: string;
  failureCode?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}
```

Implement `planOrchestrationDispatch` so it rejects task text whose UTF-8 size
exceeds `MAX_DISPATCH_TASK_BYTES`, filters recorded `agent_profile` artifacts
by source, runtime, and `candidateIndex === 0`, verifies the file with
`hashAgentProfileContent`, requires the profile path to remain under
`<homeDir>/.<runtime>/agents/`, rejects missing optional metadata from legacy
records, and enforces `--approve-workspace-write` only for write profiles.
It returns one `DispatchPlanSet`; `primary` is `candidates[0]`, and candidates
are sorted by `candidateIndex` after proving they all share the requested tier
and runtime.

- [ ] **Step 4: Add candidate-order and runtime mismatch tests**

Add a second artifact with `candidateIndex: 1` and assert:

```ts
expect(selectDispatchCandidates(installedWorkflow, "catalog:cto", "codex")).toEqual([
  expect.objectContaining({ candidateIndex: 0, model: "gpt-5.6" }),
  expect.objectContaining({ candidateIndex: 1, model: "gpt-5.4" }),
]);
```

Assert `claude` fails with `runtime_unavailable` when capability is false.

- [ ] **Step 5: Run focused tests and commit**

```bash
rtk bun test tests/orchestration-dispatch.test.ts
rtk bun run typecheck
rtk git add src/runtimes/omniskill/orchestration-dispatch.ts src/runtimes/omniskill/index.ts tests/orchestration-dispatch.test.ts
rtk git commit -m "feat: plan verified orchestration dispatch"
```

Expected: tests and typecheck pass before the commit.

## Task 3: Add bounded stdin and the Codex adapter

**Files:**

- Modify: `src/process.ts`
- Create: `src/plugins/orchestration-dispatcher.ts`
- Modify: `src/plugins/index.ts`
- Create: `tests/orchestration-dispatcher.test.ts`

- [ ] **Step 1: Write the failing adapter command test**

Use an injected runner and assert the exact launch boundary:

```ts
test("launches Codex with explicit model, effort, sandbox, and bounded stdin", async () => {
  const commands: SubprocessCommand[] = [];
  const dispatcher = createCodexCliDispatcher(async (command) => {
    commands.push(command);
    return {
      exitCode: 0,
      stderr: "",
      stdout: [
        JSON.stringify({ type: "thread.started", thread_id: "thread-1" }),
        JSON.stringify({ type: "turn.completed" }),
      ].join("\n"),
    };
  });

  const result = await dispatcher.dispatch(readOnlyPlan);

  expect(commands).toEqual([
    {
      executable: "codex",
      args: [
        "exec",
        "--json",
        "--skip-git-repo-check",
        "-C",
        "/tmp/project",
        "-m",
        "gpt-5.6",
        "-c",
        'model_reasoning_effort="high"',
        "-c",
        expect.stringContaining("developer_instructions="),
        "-s",
        "read-only",
        "-",
      ],
      cwd: "/tmp/project",
      stdin: "Review the service boundary.",
      onStdoutLine: expect.any(Function),
    },
  ]);
  expect(result).toEqual(
    expect.objectContaining({ sessionId: "thread-1", evidence: "launch_configured" }),
  );
});
```

- [ ] **Step 2: Run the adapter test and confirm red**

```bash
rtk bun test tests/orchestration-dispatcher.test.ts
```

Expected: FAIL because the adapter and `stdin` command field do not exist.

- [ ] **Step 3: Extend the subprocess seam without invoking a shell**

Add to `SubprocessCommand`:

```ts
stdin?: string;
onStdoutLine?: (line: string) => void;
```

Change `stdio` to use a pipe only when input exists, then close it deterministically:

```ts
stdio: [command.stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"],
```

Immediately after spawning:

```ts
if (command.stdin !== undefined) {
  subprocess.stdin?.end(command.stdin);
}
```

Extend `readStream` with a line callback that keeps an incomplete trailing
chunk between `data` events, emits each complete UTF-8 line once, and emits a
final non-empty trailing line on `end`. Preserve the complete buffered stdout
in `SubprocessResult` for classification and tests.

- [ ] **Step 4: Implement the adapter contract and event classifier**

Export:

```ts
export interface DispatchAttemptResult {
  status: "completed" | "failed" | "consultation_required";
  evidence: "launch_configured" | "runtime_reported";
  sessionId?: string;
  runtimeModel?: string;
  failureCode?:
    | "runtime_upgrade_required"
    | "model_unavailable"
    | "runtime_mismatch"
    | "runtime_failed";
  failureReason?: string;
  consultation?: ConsultationRequest;
}

export interface OrchestrationDispatcher {
  runtime: "codex";
  available(): Promise<boolean>;
  dispatch(plan: DispatchPlan): Promise<DispatchAttemptResult>;
  resume(input: {
    plan: DispatchPlan;
    sessionId: string;
    decision: ConsultationDecision;
    message: string;
  }): Promise<DispatchAttemptResult>;
}
```

Construct arguments as literals, encode config values with `JSON.stringify`,
parse stdout one JSON object per line, capture `thread.started`, and classify
CLI upgrade/model errors before returning. Wire `onStdoutLine` to an injected
structured-event sink so the command can display progress before completion.
If a runtime-reported model field exists and differs from the plan, return
`runtime_mismatch` without reporting completion.

- [ ] **Step 5: Add error-classification and no-shell assertions**

Test the exact known upgrade text, a model-unavailable 400 response, malformed JSONL, non-zero exit, and runtime model mismatch. Assert every runner call uses `executable: "codex"` and contains no `shell` field.

- [ ] **Step 6: Run focused tests and commit**

```bash
rtk bun test tests/orchestration-dispatcher.test.ts
rtk bun run typecheck
rtk git add src/process.ts src/plugins/orchestration-dispatcher.ts src/plugins/index.ts tests/orchestration-dispatcher.test.ts
rtk git commit -m "feat: dispatch orchestration through Codex CLI"
```

## Task 4: Add zero-write dispatch dry-run

**Files:**

- Modify: `src/omniskill.ts`
- Modify: `src/cli.ts`
- Modify: `tests/omniskill.test.ts`
- Modify: `tests/cli.test.ts`

- [ ] **Step 1: Write failing command registration and dry-run tests**

Update the root command expectation to include `dispatch` between `onboard` and `loop`. Add a temporary installed workflow/profile fixture, then run:

```ts
await program.parseAsync(
  [
    "dispatch",
    "startup-team",
    "--role",
    "catalog:cto",
    "--task",
    "Review boundaries",
    "--runtime",
    "codex",
    "--home",
    homeDir,
    "--dry-run",
    "--json",
  ],
  { from: "user" },
);
```

Assert parsed JSON contains the profile, model, effort, access, and
`evidenceRequired`, the injected dispatcher has zero calls, and
`~/.omniskills/runs` does not exist.

- [ ] **Step 2: Run the focused tests and confirm red**

```bash
rtk bun test tests/cli.test.ts tests/omniskill.test.ts --test-name-pattern "dispatch"
```

Expected: FAIL because `dispatch` is not registered.

- [ ] **Step 3: Add command options and dependency injection**

Extend `ConfigureOmniskillCommandOptions`:

```ts
dispatchers?: Partial<Record<"codex" | "claude", OrchestrationDispatcher>>;
```

Register:

```ts
command
  .command("dispatch")
  .description("Dispatch an installed Omniskills role through a verified runtime profile.")
  .argument("<workflow-name>", "installed workflow or team name")
  .requiredOption("--role <source>", "role source or support id")
  .option("--task <text>", "task text")
  .option("--task-file <path>", "read task text from a file")
  .option("--runtime <runtime>", "codex or claude", "codex")
  .option("--home <dir>", "home directory with Omniskills state", homedir())
  .option("--dir <dir>", "override directory with installed workflow records")
  .option("--approve-workspace-write", "approve the implementation write gate", false)
  .option("--dry-run", "print the launch plan without starting a child", false)
  .option("--json", "print machine-readable output", false);
```

Reject both/neither task sources. Resolve relative task files against `rootDir`. Load the installed record with `loadInstalledWorkflowBundle`, plan through `planOrchestrationDispatch`, and return immediately on dry-run.

- [ ] **Step 4: Inject only the default Codex adapter**

In `buildProgram`, pass:

```ts
dispatchers: {
  codex: createCodexCliDispatcher(runSubprocess),
},
```

Do not add a Claude entry. A Claude request must return `runtime_unavailable`.

- [ ] **Step 5: Run focused tests and commit**

```bash
rtk bun test tests/cli.test.ts tests/omniskill.test.ts --test-name-pattern "dispatch|registers Omniskills"
rtk bun run typecheck
rtk git add src/omniskill.ts src/cli.ts tests/omniskill.test.ts tests/cli.test.ts
rtk git commit -m "feat: preview orchestration dispatch"
```

## Task 5: Execute and persist truthful receipts

**Files:**

- Create: `src/plugins/orchestration-run-store.ts`
- Modify: `src/plugins/index.ts`
- Modify: `src/omniskill.ts`
- Create: `tests/orchestration-run-store.test.ts`
- Modify: `tests/omniskill.test.ts`

- [ ] **Step 1: Write failing atomic-store and command tests**

Test that `createDispatchRun` writes these JSON values under a temporary home:

```ts
expect(JSON.parse(await readFile(join(runDir, "request.json"), "utf8"))).toEqual(request);
expect(JSON.parse(await readFile(join(runDir, "plan.json"), "utf8"))).toEqual(plan);
expect(JSON.parse(await readFile(join(runDir, "receipt.json"), "utf8"))).toEqual(
  expect.objectContaining({ status: "planned", evidence: "requested" }),
);
```

At the command seam, inject a completed dispatcher and assert one call plus a final receipt with `status: "completed"` and `evidence: "launch_configured"`.

- [ ] **Step 2: Run the focused tests and confirm red**

```bash
rtk bun test tests/orchestration-run-store.test.ts tests/omniskill.test.ts --test-name-pattern "dispatch run|executes dispatch"
```

Expected: FAIL because no run store or execution path exists.

- [ ] **Step 3: Implement the run store**

Export an injected store interface:

```ts
export interface OrchestrationRunStore {
  create(input: { request: DispatchRequest; plan: DispatchPlan }): Promise<DispatchReceipt>;
  appendAttempt(runId: string, attempt: DispatchAttempt): Promise<void>;
  finish(runId: string, receipt: DispatchReceipt): Promise<void>;
  load(runId: string): Promise<StoredDispatchRun>;
}
```

Use `crypto.randomUUID()` for run IDs, `writeFile` to a same-directory temporary path followed by `rename` for JSON files, and `appendFile` for newline-delimited attempts. Serialize with two-space indentation and a trailing newline.

- [ ] **Step 4: Execute only after the planned receipt exists**

The command order is:

```ts
const receipt = await runStore.create({ request, plan: planSet.primary });
const result = await dispatcher.dispatch(planSet.primary);
await runStore.appendAttempt(receipt.runId, toDispatchAttempt(planSet.primary, result));
await runStore.finish(receipt.runId, finishDispatchReceipt(receipt, result));
```

If launch throws, convert it to a typed failed attempt and finish the receipt before returning the command error.

- [ ] **Step 5: Run focused tests and commit**

```bash
rtk bun test tests/orchestration-run-store.test.ts tests/omniskill.test.ts --test-name-pattern "dispatch"
rtk bun run typecheck
rtk git add src/plugins/orchestration-run-store.ts src/plugins/index.ts src/omniskill.ts tests/orchestration-run-store.test.ts tests/omniskill.test.ts
rtk git commit -m "feat: persist orchestration dispatch receipts"
```

## Task 6: Enforce retry, same-tier fallback, and mismatch failure

**Files:**

- Modify: `src/runtimes/omniskill/orchestration-dispatch.ts`
- Modify: `src/omniskill.ts`
- Modify: `tests/orchestration-dispatch.test.ts`
- Modify: `tests/omniskill.test.ts`

- [ ] **Step 1: Write the failing attempt-sequence tests**

Use two deep Codex candidates and a configured retry limit of one. Assert the attempt models are exactly:

```ts
expect(attempts.map(({ model }) => model)).toEqual([
  "gpt-5.6",
  "gpt-5.6",
  "gpt-5.4",
  "gpt-5.4",
]);
```

Assert fallback occurs only after a failed result, every transition records the prior reason, `runtime_mismatch` stops immediately, and exhaustion returns `retry_exhausted`. Add a lower-tier candidate fixture and assert it is never selected by automatic progression.

- [ ] **Step 2: Run the focused tests and confirm red**

```bash
rtk bun test tests/orchestration-dispatch.test.ts tests/omniskill.test.ts --test-name-pattern "retry|fallback|mismatch"
```

Expected: FAIL because the command currently performs one attempt.

- [ ] **Step 3: Implement the pure attempt schedule**

Export:

```ts
export function createDispatchAttemptSchedule(input: {
  candidates: DispatchPlan[];
  retryPerCandidate: number;
}): DispatchPlan[] {
  return input.candidates.flatMap((candidate) =>
    Array.from({ length: input.retryPerCandidate + 1 }, () => candidate),
  );
}
```

Require every candidate to match the first candidate's runtime and tier before
scheduling. The command advances only for `failed` results whose failure code
is not `runtime_mismatch` or `approval_required`; a
`consultation_required` status suspends immediately and never enters fallback.
The command passes `planSet.candidates` into this function.

- [ ] **Step 4: Persist each attempt and disclosed transition**

Add `attemptNumber`, `candidateIndex`, `model`, `failureCode`, `failureReason`, and `fallbackFromAttempt` to each attempt record. Render the transition before launching the next candidate.

- [ ] **Step 5: Run focused tests and commit**

```bash
rtk bun test tests/orchestration-dispatch.test.ts tests/omniskill.test.ts --test-name-pattern "dispatch|retry|fallback|mismatch"
rtk bun run typecheck
rtk git add src/runtimes/omniskill/orchestration-dispatch.ts src/omniskill.ts tests/orchestration-dispatch.test.ts tests/omniskill.test.ts
rtk git commit -m "feat: enforce orchestration fallback limits"
```

## Task 7: Suspend and resume structured consultations

**Files:**

- Modify: `src/runtimes/omniskill/orchestration-dispatch.ts`
- Modify: `src/plugins/orchestration-dispatcher.ts`
- Modify: `src/omniskill.ts`
- Modify: `tests/orchestration-dispatch.test.ts`
- Modify: `tests/orchestration-dispatcher.test.ts`
- Modify: `tests/omniskill.test.ts`

- [ ] **Step 1: Write failing consultation classification and resume tests**

Use a final agent message containing:

```json
{
  "type": "consultation_request",
  "trigger": "requirement_conflict",
  "current_task": "Choose the API boundary",
  "evidence": ["Two approved requirements conflict"],
  "decision_needed": "Which requirement wins?",
  "recommendation": "Escalate to the product owner"
}
```

Assert the first command persists `status: "consultation_required"`. Parse:

```bash
omniskill dispatch resume <run-id> --decision continue --message "Use requirement A" --home <temp-home>
```

Assert resume invokes `codex exec resume <session-id> --json -`, preserves the original profile/model/access, increments consultation count, and finishes the same run.
Add a `reassign` case requiring `--role catalog:product-manager`; assert it
plans and launches that recorded profile under the same run ID, records the
original task and decision message as the handoff, increments
`reassignmentCount`, and rejects a second reassignment when the configured
limit is one.

- [ ] **Step 2: Run focused tests and confirm red**

```bash
rtk bun test tests/orchestration-dispatch.test.ts tests/orchestration-dispatcher.test.ts tests/omniskill.test.ts --test-name-pattern "consultation|resume"
```

Expected: FAIL because consultation events and resume are not implemented.

- [ ] **Step 3: Add strict schemas and state transitions**

Use the strict `ConsultationRequestSchema` and
`ConsultationDecisionSchema` created with the planner, then implement the
state transitions:

```ts
const parsed = ConsultationRequestSchema.safeParse(finalAgentMessage);
if (parsed.success) {
  return {
    status: "consultation_required",
    evidence,
    sessionId,
    consultation: parsed.data,
  };
}
```

Reject malformed requests as ordinary completed text, reject resume when the stored profile hash has drifted, reject a third consultation, and reject repeated evidence identical to the prior request.

- [ ] **Step 4: Implement Codex resume arguments**

Use:

```ts
{
  executable: "codex",
  args: ["exec", "resume", input.sessionId, "--json", "-"],
  cwd: input.plan.cwd,
  stdin: JSON.stringify({ decision: input.decision, message: input.message }),
}
```

The command must load the original run, re-read and hash the profile, validate the decision, then call `resume`. `escalate-to-human` records a terminal suspended receipt and launches nothing.

Add optional `--role <replacement-source>` to `dispatch resume`. Require it
only for `reassign`. For that decision, call `planOrchestrationDispatch` with
the stored workflow, original task plus decision handoff, replacement role,
original runtime, and original workspace approval. Launch the replacement
primary profile as a new child rather than resuming the old session. Reject the
transition when `reassignmentCount >= plan.limits.reassignmentPerWorkItem`.

- [ ] **Step 5: Run focused tests and commit**

```bash
rtk bun test tests/orchestration-dispatch.test.ts tests/orchestration-dispatcher.test.ts tests/omniskill.test.ts --test-name-pattern "consultation|resume|dispatch"
rtk bun run typecheck
rtk git add src/runtimes/omniskill/orchestration-dispatch.ts src/plugins/orchestration-dispatcher.ts src/omniskill.ts tests/orchestration-dispatch.test.ts tests/orchestration-dispatcher.test.ts tests/omniskill.test.ts
rtk git commit -m "feat: resume orchestration consultations"
```

## Task 8: Align startup-team guidance and operator documentation

**Files:**

- Modify: `examples/teams/startup-team/skills/startup-goal/SKILL.md`
- Modify: `examples/teams/startup-team/README.md`
- Modify: `docs/architecture.md`
- Modify: `tests/workflow-bundles.test.ts`
- Modify: `tests/readme.test.ts`

- [ ] **Step 1: Write failing contract assertions**

Assert the installed startup-goal skill contains all of these phrases:

```ts
expect(skill).toContain("omniskill dispatch");
expect(skill).toContain("launch_configured");
expect(skill).toContain("Generic `spawn_agent` is unverified");
expect(skill).toContain("Unavailable dispatch");
```

Assert the README documents dry-run, workspace-write approval, evidence levels, unsupported Claude execution, receipt location, and removal compatibility.

- [ ] **Step 2: Run documentation tests and confirm red**

```bash
rtk bun test tests/workflow-bundles.test.ts tests/readme.test.ts --test-name-pattern "startup team|dispatch"
```

Expected: FAIL because current guidance claims generated profiles without naming the enforceable dispatch path.

- [ ] **Step 3: Update the skill and docs**

Replace generic verified dispatch language with this contract:

```text
Before disclosing model or effort, run an Omniskills dispatch preflight for the
selected role. Use the returned profile, tier, model, effort, access, adapter,
and evidence level. Generic `spawn_agent` is unverified and cannot satisfy a
startup-team tier assignment. If preflight cannot produce at least
launch_configured evidence, show the role brief under `Unavailable dispatch`
and stop.
```

Document the exact CLI examples from the design and add
`orchestration-dispatch.ts`, `orchestration-dispatcher.ts`, and
`orchestration-run-store.ts` to the architecture source map and boundaries.

- [ ] **Step 4: Refresh the startup-team lock if the local skill fingerprint changes**

Run:

```bash
rtk bun run dev -- lock examples/teams/startup-team
```

If the lock changes, include `examples/teams/startup-team/workflow.lock.json` in this task's Pony Trail snapshot and commit. Validate the bundle afterward.

- [ ] **Step 5: Run focused tests and commit**

```bash
rtk bun test tests/workflow-bundles.test.ts tests/readme.test.ts --test-name-pattern "startup team|dispatch"
rtk bun run dev -- validate examples/teams/startup-team
rtk git add examples/teams/startup-team/skills/startup-goal/SKILL.md examples/teams/startup-team/README.md examples/teams/startup-team/workflow.lock.json docs/architecture.md tests/workflow-bundles.test.ts tests/readme.test.ts
rtk git commit -m "docs: require verified startup-team dispatch"
```

## Task 9: Full verification and scratch lifecycle smoke

**Files:**

- Use ignored scratch state under `work/orchestration-dispatch-smoke/`
- Modify source only if verification finds an evidenced defect; snapshot any such correction separately.

- [ ] **Step 1: Run the complete repository gate**

```bash
rtk bun run check
```

Expected: Biome, TypeScript, all Bun tests, and the 90% line-coverage gate pass.

- [ ] **Step 2: Build and inspect the CLI surface**

```bash
rtk bun run build
rtk bun run dev -- --help
rtk bun run dev -- dispatch --help
```

Expected: build exits zero and help shows `dispatch`, task input, runtime, approval, dry-run, and JSON options.

- [ ] **Step 3: Run an isolated install and zero-write dispatch preview**

```bash
rtk bun run dev -- install examples/teams/startup-team --home work/orchestration-dispatch-smoke/home --agents codex --dry-run
rtk bun run dev -- install examples/teams/startup-team --home work/orchestration-dispatch-smoke/home --agents codex
rtk bun run dev -- dispatch startup-team --role catalog:cto --task "Return ORCHESTRATION_DISPATCH_OK" --runtime codex --home work/orchestration-dispatch-smoke/home --dry-run --json
```

Expected: install preview is zero-write; approved install creates managed profiles; dispatch dry-run reports deep/read-only/model/effort with no run directory.

- [ ] **Step 4: Attempt one live Codex launch or record the exact unavailable signal**

```bash
rtk bun run dev -- dispatch startup-team --role catalog:cto --task "Return ORCHESTRATION_DISPATCH_OK" --runtime codex --home work/orchestration-dispatch-smoke/home --json
```

Expected: either a completed receipt containing the exact text, or a typed failed receipt such as `runtime_upgrade_required` or `model_unavailable`. Do not describe the latter as a live pass.

- [ ] **Step 5: Verify fail-closed access and Claude behavior**

Run a write-profile dry-run without approval and expect `approval_required`; rerun with `--approve-workspace-write` and confirm the plan remains `standard / workspace-write`. Request `--runtime claude` and expect `runtime_unavailable` with no process launch.

- [ ] **Step 6: Verify removal and final repository state**

```bash
rtk bun run dev -- remove startup-team --home work/orchestration-dispatch-smoke/home --dry-run
rtk bun run dev -- remove startup-team --home work/orchestration-dispatch-smoke/home --yes
rtk git diff --check
rtk git status --short
```

Expected: removal deletes clean managed profiles and workflow record, preserves the user-owned global orchestration config, diff check is empty, and only intentional tracked changes remain before the final commit.

- [ ] **Step 7: Final requirements review**

Re-read the design acceptance criteria and match each criterion to a test or
smoke result.
If verification required a corrective code change, snapshot, test, and commit
that correction separately. Do not create an empty verification commit, and do
not push unless the user explicitly requests publication.
