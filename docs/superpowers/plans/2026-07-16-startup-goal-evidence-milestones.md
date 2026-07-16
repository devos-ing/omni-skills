# Startup Goal Evidence Milestones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `startup-team` run one evidence-backed feature milestone at a time, pause for plan and result approval, resume safely, and evaluate the verified result against reconstructed user expectations, needs, wishes, and journey steps.

**Architecture:** Extend the existing action-only Omniskills loop with a focused milestone-state module. The generic runtime persists goal-tunnel, packet, decision, evidence, QA, and outcome-replay state while `startup-goal` controls only inputs, outputs, gates, and direction; role skills retain content autonomy and optional methods. Automatic dispatch remains disabled, so every runtime action produces a manual handoff.

**Tech Stack:** Bun, TypeScript, dependency-free Node ESM runtime helpers, Zod manifest validation, Commander CLI, JSON/JSONL run state, Bun tests, Biome.

---

## File Map

- Create `src/runtimes/omniskill/workflow-milestones.mjs`: validate milestone packets and own pure state transitions.
- Create `tests/workflow-milestones.test.ts`: unit-test packet evidence rules, transitions, loop caps, and outcome replay.
- Modify `src/runtimes/omniskill/workflow-bundles.ts`: declare `milestone_based` loop metadata and validate its role configuration.
- Modify `tests/workflow-bundles.test.ts`: lock milestone manifests, startup-team lifecycle, optional role methods, and implementation ownership.
- Modify `src/runtimes/omniskill/workflow-loop-runtime.mjs`: persist milestone state and connect `start`, `status`, `log`, `advance`, and `summary`.
- Modify `tests/loop-runtime.test.ts`: test direct milestone runs, evidence blocking, resume, rework, acceptance, and completion.
- Modify `src/omniskill.ts`: expose start input files and log metadata files through the existing loop CLI.
- Modify `tests/cli.test.ts`: cover Commander forwarding and startup-team CLI smoke behavior.
- Modify `examples/teams/startup-team/workflow.json`: enable the action-only milestone loop and replace mandatory role sequence steps with lifecycle steps.
- Modify `examples/teams/startup-team/skills/startup-goal/SKILL.md`: encode the goal tunnel, packets, evidence ledger, manual lifecycle, and User Outcome Replay.
- Modify `examples/teams/startup-team/README.md`: document manual milestone start/resume commands and approval gates.
- Modify the seven role `SKILL.md` files under `examples/workflows/{ceo,product-manager,web-design,cto,engineering-manager,founding-engineer,qa-lead}/skills/`: make methods optional and add input/output contracts.
- Modify the seven corresponding `workflow.json` and `workflow.lock.json` files: remove unconditional companion-skill execution steps and refresh fingerprints.
- Modify `README.md`, `README.zh-Hant.md`, `docs/landing-content.md`, `docs/landing-content.zh-Hant.md`, and `landing/lib/landing-content.ts`: keep public startup-team flow descriptions aligned.
- Modify `tests/readme.test.ts` and `tests/landing-app.test.ts`: reject the old monolithic QA-ending description.

## Repository Rules

- Run every shell command through `rtk`.
- Use `apply_patch` for file mutations.
- Take the Pony Trail pre/post snapshots specified by the active execution skill before each mutation task.
- The worktree already contains unrelated model-routing, team, and landing changes. Re-read every target file before editing and stage only the paths named by the current task.
- Do not restore `examples/teams/startup-team/workflow.lock.json`; the current pre-release team intentionally omits it.
- Do not import, export, or call the disabled dispatch runtime.
- Do not add a package.

## Public Interfaces

The implementation must keep these seams stable:

```js
// src/runtimes/omniskill/workflow-milestones.mjs
export function createMilestoneState(input, now);
export function recordMilestoneEvent(state, event);
export function advanceMilestoneState(state, now);
export function getMilestoneView(state);
export function buildMilestoneSummary(state);
```

```ts
// Existing runtime seam
runWorkflowLoopCli({ argv, workflowJson, cwd, homeDir, commandPrefix }): Promise<number>
```

```text
omniskill loop start <source> --input <json> | --input-file <path>
omniskill loop log <source> --run <id> --type <event> --metadata <json> | --metadata-file <path>
omniskill loop status <source> --run <id> | --latest
omniskill loop advance <source> --run <id>
omniskill loop summary <source> --run <id> | --latest
```

### Task 1: Add the milestone-loop manifest contract

**Files:**
- Modify: `tests/workflow-bundles.test.ts`
- Modify: `src/runtimes/omniskill/workflow-bundles.ts`

- [ ] **Step 1: Add failing manifest tests**

Add these cases beside the existing goal-based loop manifest tests:

```ts
test("loads a milestone-based team loop with explicit execution owners", () => {
  const manifest = WorkflowBundleManifestSchema.parse({
    ...validTeamManifest,
    loop: {
      script: "./loop.mjs",
      state: "global",
      execution: "action-only",
      type: "milestone_based",
      goal: "Deliver approved startup milestones.",
      done_when: ["all_milestones_accepted"],
      stop_when: ["human_stops", "critical_evidence_missing"],
      milestone: {
        coordinator: "./skills/coordinator",
        implementer: "external-review",
        verifier: "catalog:member-workflow",
      },
    },
  });

  expect(manifest.loop?.type).toBe("milestone_based");
  expect(manifest.loop?.milestone).toEqual({
    coordinator: "./skills/coordinator",
    implementer: "external-review",
    verifier: "catalog:member-workflow",
  });
});

test("rejects incomplete or undeclared milestone-loop owners", () => {
  const base = {
    ...validTeamManifest,
    loop: {
      script: "./loop.mjs",
      state: "global",
      execution: "action-only",
      type: "milestone_based",
      goal: "Deliver approved startup milestones.",
      done_when: ["all_milestones_accepted"],
      stop_when: ["human_stops"],
    },
  };

  expect(() => WorkflowBundleManifestSchema.parse(base)).toThrow(
    "Milestone-based loops must declare loop.milestone",
  );
  expect(() =>
    WorkflowBundleManifestSchema.parse({
      ...base,
      loop: {
        ...base.loop,
        milestone: {
          coordinator: "./skills/coordinator",
          implementer: "missing-implementer",
          verifier: "catalog:member-workflow",
        },
      },
    }),
  ).toThrow("Milestone loop owner must be declared in skills: missing-implementer");
});
```

- [ ] **Step 2: Run the tests and verify red**

Run:

```bash
rtk bun test tests/workflow-bundles.test.ts --test-name-pattern "milestone-based"
```

Expected: FAIL because `WorkflowLoopSchema` accepts only `goal_based` and has no `milestone` field.

- [ ] **Step 3: Extend the manifest schema and metadata type**

Add above `WorkflowLoopSchema`:

```ts
const WorkflowMilestoneLoopSchema = z.object({
  coordinator: z.string().min(1),
  implementer: z.string().min(1),
  verifier: z.string().min(1),
});
```

Change `WorkflowLoopSchema` fields to:

```ts
type: z.enum(["goal_based", "milestone_based"]).optional(),
goal: z.string().min(1).optional(),
done_when: z.array(z.string().min(1)).min(1).optional(),
stop_when: z.array(z.string().min(1)).min(1).optional(),
milestone: WorkflowMilestoneLoopSchema.optional(),
```

In `WorkflowBundleManifestSchema.superRefine`, change the existing goal contract condition to cover both loop types:

```ts
if (
  manifest.loop?.type === "goal_based" ||
  manifest.loop?.type === "milestone_based"
) {
  if (!manifest.loop.goal) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Goal and milestone loops must declare loop.goal",
      path: ["loop", "goal"],
    });
  }
  if (!manifest.loop.done_when) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Goal and milestone loops must declare loop.done_when",
      path: ["loop", "done_when"],
    });
  }
  if (!manifest.loop.stop_when) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Goal and milestone loops must declare loop.stop_when",
      path: ["loop", "stop_when"],
    });
  }
}
```

Then add:

```ts
if (manifest.loop?.type === "milestone_based") {
  if (!manifest.loop.milestone) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Milestone-based loops must declare loop.milestone",
      path: ["loop", "milestone"],
    });
  } else {
    for (const [owner, source] of Object.entries(manifest.loop.milestone)) {
      if (!skillSources.has(source)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Milestone loop owner must be declared in skills: ${source}`,
          path: ["loop", "milestone", owner],
        });
      }
    }
  }
}

if (manifest.loop?.type !== "milestone_based" && manifest.loop?.milestone) {
  context.addIssue({
    code: z.ZodIssueCode.custom,
    message: "loop.milestone requires loop.type milestone_based",
    path: ["loop", "milestone"],
  });
}
```

Update `WorkflowLoopMetadata`:

```ts
type?: "goal_based" | "milestone_based";
milestone?: {
  coordinator: string;
  implementer: string;
  verifier: string;
};
```

Add the optional field in `createWorkflowLoopMetadata`:

```ts
...(bundle.manifest.loop.milestone
  ? { milestone: bundle.manifest.loop.milestone }
  : {}),
```

- [ ] **Step 4: Run focused tests**

```bash
rtk bun test tests/workflow-bundles.test.ts --test-name-pattern "milestone-based|looped workflow manifest|grilled-product-dev"
```

Expected: PASS, including unchanged goal-based compatibility tests.

- [ ] **Step 5: Commit**

```bash
rtk git add src/runtimes/omniskill/workflow-bundles.ts tests/workflow-bundles.test.ts
rtk git diff --cached --check
rtk git commit -m "feat: add milestone loop manifest contract"
```

### Task 2: Build the pure milestone state module

**Files:**
- Create: `src/runtimes/omniskill/workflow-milestones.mjs`
- Create: `tests/workflow-milestones.test.ts`

- [ ] **Step 1: Write failing state-contract tests**

Create `tests/workflow-milestones.test.ts` with a shared valid input:

```ts
import { describe, expect, test } from "bun:test";
import {
  advanceMilestoneState,
  buildMilestoneSummary,
  createMilestoneState,
  getMilestoneView,
  recordMilestoneEvent,
} from "../src/runtimes/omniskill/workflow-milestones.mjs";

const NOW = "2026-07-16T00:00:00.000Z";

const startInput = {
  goalTunnel: {
    goal: "Ship an evidence-backed onboarding improvement.",
    user: "A new solo founder",
    problem: "The first run is confusing",
    outcome: "The founder completes a useful first run",
    scope: ["first-run onboarding"],
    nonGoals: ["billing"],
    constraints: ["automatic dispatch remains disabled"],
    successCriteria: ["first run can be completed manually"],
    assumptions: [],
  },
  milestones: [
    {
      id: "onboarding-copy",
      title: "Clarify onboarding copy",
      outcome: "The user understands the first action",
      accountableRole: "catalog:product-manager",
      dependencies: [],
      acceptanceCriteria: ["The next action is explicit"],
    },
    {
      id: "onboarding-check",
      title: "Verify the first-run journey",
      outcome: "The intended journey completes",
      accountableRole: "catalog:qa-lead",
      dependencies: ["onboarding-copy"],
      acceptanceCriteria: ["Every journey step has evidence"],
    },
  ],
};

const validInputPacket = {
  featureOutcome: "The user understands the first action",
  sourceContext: ["approved onboarding brief", "tests/onboarding.test.ts"],
  constraints: ["automatic dispatch remains disabled"],
  permissions: ["read repository", "prepare manual handoffs"],
  decision: "Choose the smallest copy change that clarifies the next action",
  expectedArtifact: "Approved implementation plan",
  acceptanceCriteria: ["The next action is explicit"],
  priorDecisions: ["Do not change billing"],
  accountableRole: "catalog:product-manager",
};

const validRoleOutput = {
  role: "catalog:product-manager",
  recommendation: "Lead with the first useful action",
  alternatives: ["Explain every capability before the first action"],
  evidence: [
    {
      claim: "The current next action is ambiguous",
      classification: "verified",
      risk: "high",
      source: "tests/onboarding.test.ts",
      observedAt: "2026-07-16",
    },
  ],
  risks: ["Copy alone may not resolve interaction friction"],
  unresolvedQuestions: [],
  verificationMethod: "Replay the first-user journey",
  nextAction: "Approve the focused copy plan",
};

const validOutcomeReplay = {
  user: "A new solo founder",
  expectations: [
    {
      original: "Know what to do first",
      originalEvidence: "approved onboarding brief",
      status: "met",
      resultEvidence: "QA first-run transcript",
      gapType: "none",
    },
  ],
  needs: [
    {
      original: "Complete a useful first action",
      originalEvidence: "goalTunnel.successCriteria[0]",
      status: "met",
      resultEvidence: "QA first-run transcript",
      gapType: "none",
    },
  ],
  wishes: [
    {
      original: "See a richer tutorial",
      originalEvidence: "user interview note",
      status: "unmet",
      resultEvidence: "No tutorial was in the approved scope",
      gapType: "new_wish",
    },
  ],
  steps: [
    {
      expected: "Read the next action and start",
      actual: "Read the next action and started",
      status: "met",
      resultEvidence: "QA first-run transcript",
    },
  ],
  recommendation: "accept",
};

function runAcceptedMilestone(input: typeof startInput) {
  let state = createMilestoneState(input, NOW);
  state = recordMilestoneEvent(state, { type: "input_packet", metadata: validInputPacket });
  state = advanceMilestoneState(state, NOW);
  state = recordMilestoneEvent(state, { type: "role_output", metadata: validRoleOutput });
  state = advanceMilestoneState(state, NOW);
  state = recordMilestoneEvent(state, {
    type: "plan_decision",
    metadata: { decision: "approve", approvedBy: "human" },
  });
  state = advanceMilestoneState(state, NOW);
  state = recordMilestoneEvent(state, {
    type: "implementation_result",
    metadata: {
      summary: "Clarified the first action",
      changedFiles: ["src/onboarding.ts"],
      verificationCommands: ["bun test tests/onboarding.test.ts"],
    },
  });
  state = advanceMilestoneState(state, NOW);
  state = recordMilestoneEvent(state, {
    type: "verification_result",
    metadata: {
      result: "pass",
      evidence: ["bun test tests/onboarding.test.ts: pass"],
      residualRisk: [],
    },
  });
  state = advanceMilestoneState(state, NOW);
  state = recordMilestoneEvent(state, {
    type: "outcome_replay",
    metadata: validOutcomeReplay,
  });
  state = advanceMilestoneState(state, NOW);
  state = recordMilestoneEvent(state, {
    type: "acceptance_decision",
    metadata: { decision: "accept", approvedBy: "human" },
  });
  return advanceMilestoneState(state, NOW);
}
```

Add tests with these exact assertions:

```ts
test("creates one active milestone without losing the goal tunnel", () => {
  const state = createMilestoneState(startInput, NOW);
  expect(state.schemaVersion).toBe("0.2");
  expect(state.status).toBe("active");
  expect(state.currentMilestoneIndex).toBe(0);
  expect(state.milestones.map((item: { status: string }) => item.status)).toEqual([
    "active",
    "pending",
  ]);
  expect(getMilestoneView(state)).toMatchObject({
    stage: "preparing",
    milestone: { id: "onboarding-copy" },
  });
});

test("blocks plan approval when a high-risk claim is not verified", () => {
  let state = createMilestoneState(startInput, NOW);
  state = recordMilestoneEvent(state, {
    type: "input_packet",
    metadata: validInputPacket,
  });
  state = advanceMilestoneState(state, NOW);
  state = recordMilestoneEvent(state, {
    type: "role_output",
    metadata: {
      ...validRoleOutput,
      evidence: [
        {
          claim: "Users understand the new copy",
          classification: "assumed",
          risk: "high",
          consequence: "The milestone may not solve onboarding",
          validationAction: "Run the first-user journey",
        },
      ],
    },
  });
  expect(() => advanceMilestoneState(state, NOW)).toThrow(
    "High-risk claims must be verified before plan approval",
  );
});

test("caps repair and targeted review loops at one", () => {
  let state = createMilestoneState(startInput, NOW);
  state = recordMilestoneEvent(state, { type: "repair_request", metadata: { reason: "shape" } });
  expect(() =>
    recordMilestoneEvent(state, { type: "repair_request", metadata: { reason: "again" } }),
  ).toThrow("Only one output repair is allowed per milestone");

  state = recordMilestoneEvent(state, {
    type: "targeted_review",
    metadata: { reason: "material disagreement" },
  });
  expect(() =>
    recordMilestoneEvent(state, {
      type: "targeted_review",
      metadata: { reason: "repeat" },
    }),
  ).toThrow("Only one targeted second review is allowed per milestone");
});

test("replays user outcomes and carries accepted context to the next milestone", () => {
  const state = runAcceptedMilestone(startInput);
  const view = getMilestoneView(state);
  expect(view.milestone.id).toBe("onboarding-check");
  expect(view.stage).toBe("preparing");
  expect(state.milestones[0]).toMatchObject({ status: "accepted" });
  expect(state.milestones[0].outcomeReplay.needs[0]).toMatchObject({ status: "met" });
  expect(buildMilestoneSummary(state)).toContain("User Outcome Replay");
});
```

Define `validInputPacket`, `validRoleOutput`, and `runAcceptedMilestone` in the test file using the packet shapes in Step 3; do not use `as any`.

- [ ] **Step 2: Run tests and verify red**

```bash
rtk bun test tests/workflow-milestones.test.ts
```

Expected: FAIL because `workflow-milestones.mjs` does not exist.

- [ ] **Step 3: Implement packet validators and initial state**

Create `src/runtimes/omniskill/workflow-milestones.mjs`. Use these canonical values:

```js
const stages = [
  "preparing",
  "planning",
  "awaiting_plan_approval",
  "implementing",
  "rework",
  "verifying",
  "evaluating",
  "awaiting_acceptance",
];

const statuses = new Set(["active", "needs_evidence", "blocked", "complete"]);
const evidenceClasses = new Set(["verified", "inferred", "assumed"]);
const riskLevels = new Set(["low", "high"]);
const resultStatuses = new Set(["met", "partially_met", "unmet", "not_evaluated"]);
```

Implement strict object/string/string-array helpers. Unknown keys may be retained for forward-compatible evidence metadata, but every required key below must be validated.

```js
function validateStartInput(value) {
  const input = requireObject(value, "start input");
  const goalTunnel = requireObject(input.goalTunnel, "goalTunnel");
  for (const key of ["goal", "user", "problem", "outcome"]) requireString(goalTunnel[key], key);
  for (const key of ["scope", "nonGoals", "constraints", "successCriteria", "assumptions"]) {
    requireStringArray(goalTunnel[key], `goalTunnel.${key}`);
  }
  if (!Array.isArray(input.milestones) || input.milestones.length === 0) {
    throw new Error("start input milestones must contain at least one milestone");
  }
  const ids = new Set();
  const positions = new Map();
  for (const [index, milestone] of input.milestones.entries()) {
    const item = requireObject(milestone, "milestone");
    for (const key of ["id", "title", "outcome", "accountableRole"]) {
      requireString(item[key], `milestone.${key}`);
    }
    requireStringArray(item.dependencies, "milestone.dependencies");
    requireStringArray(item.acceptanceCriteria, "milestone.acceptanceCriteria");
    if (ids.has(item.id)) throw new Error(`Duplicate milestone id: ${item.id}`);
    ids.add(item.id);
    positions.set(item.id, index);
  }
  for (const [index, milestone] of input.milestones.entries()) {
    for (const dependency of milestone.dependencies) {
      const dependencyIndex = positions.get(dependency);
      if (dependencyIndex === undefined) {
        throw new Error(`Unknown milestone dependency: ${dependency}`);
      }
      if (dependencyIndex >= index) {
        throw new Error(`Milestone dependency must refer to an earlier milestone: ${dependency}`);
      }
    }
  }
  return structuredClone(input);
}
```

Use this persisted state shape:

```js
export function createMilestoneState(value, now = new Date().toISOString()) {
  const input = validateStartInput(value);
  return {
    schemaVersion: "0.2",
    status: "active",
    goalTunnel: input.goalTunnel,
    currentMilestoneIndex: 0,
    milestones: input.milestones.map((milestone, index) => ({
      ...milestone,
      status: index === 0 ? "active" : "pending",
      stage: "preparing",
      repairCount: 0,
      targetedReviewCount: 0,
      inputPacket: null,
      roleOutputs: [],
      evidenceGaps: [],
      planDecision: null,
      implementationResults: [],
      verificationResult: null,
      outcomeReplay: null,
      acceptanceDecision: null,
    })),
    createdAt: now,
    updatedAt: now,
  };
}
```

- [ ] **Step 4: Implement evidence and event validation**

Use these required packet shapes:

```js
// input_packet metadata
{
  featureOutcome: string,
  sourceContext: string[],
  constraints: string[],
  permissions: string[],
  decision: string,
  expectedArtifact: string,
  acceptanceCriteria: string[],
  priorDecisions: string[],
  accountableRole: string
}

// role_output metadata
{
  role: string,
  recommendation: string,
  alternatives: string[],
  evidence: EvidenceItem[],
  risks: string[],
  unresolvedQuestions: string[],
  verificationMethod: string,
  nextAction: string
}

// EvidenceItem rules
// verified -> source:string
// inferred -> supports:string[] with at least one entry
// assumed -> consequence:string and validationAction:string
// every item -> claim:string, classification, risk

// outcome_replay metadata
{
  user: string,
  expectations: OutcomeItem[],
  needs: OutcomeItem[],
  wishes: OutcomeItem[],
  steps: JourneyStep[],
  recommendation: "accept" | "rework" | "new_milestone"
}

// remaining decision/result metadata
// plan_decision -> { decision: "approve" | "revise" | "research" | "skip" | "stop", approvedBy: string }
// implementation_result -> { summary: string, changedFiles: string[], verificationCommands: string[] }
// verification_result -> { result: "pass" | "fail", evidence: string[], residualRisk: string[] }
// acceptance_decision -> {
//   decision: "accept" | "rework" | "new_milestone" | "rollback" | "stop",
//   approvedBy: string,
//   newMilestone?: {
//     id: string,
//     title: string,
//     outcome: string,
//     accountableRole: string,
//     dependencies: string[],
//     acceptanceCriteria: string[]
//   }
// }
```

`OutcomeItem` requires `original`, `originalEvidence`, `status`, `resultEvidence`, and `gapType`, where `gapType` is `approved_requirement`, `new_wish`, or `none`. `JourneyStep` requires `expected`, `actual`, `status`, and `resultEvidence`.

The milestone runtime accepts only these additional event types:

```js
[
  "input_packet",
  "role_output",
  "evidence_gap",
  "evidence_resolved",
  "plan_decision",
  "implementation_result",
  "verification_result",
  "outcome_replay",
  "acceptance_decision",
  "repair_request",
  "targeted_review",
  "scope_change",
]
```

Implement `recordMilestoneEvent` as a `switch` that validates stage-appropriate events and returns a cloned state. Store the packet on the active milestone, require `input_packet.accountableRole` to equal the milestone owner, increment `repairCount` or `targetedReviewCount`, and reject a second increment. `evidence_gap` sets overall status to `needs_evidence`; `evidence_resolved` closes a named gap and returns the status to `active` only when no critical gap remains. `scope_change` records `{ requested, approved, impact }` and sets the overall status to `blocked` pending human reapproval.

- [ ] **Step 5: Implement the transition table exactly**

`advanceMilestoneState` must follow this table:

| Current stage | Required data | Next result |
| --- | --- | --- |
| `preparing` | `inputPacket` | `planning` |
| `planning` | one role output; all high-risk evidence verified | `awaiting_plan_approval` |
| `awaiting_plan_approval` | plan decision `approve` | `implementing` |
| `awaiting_plan_approval` | `revise` or `research` | `planning` |
| `awaiting_plan_approval` | `skip` | mark skipped and activate next milestone |
| `awaiting_plan_approval` | `stop` | overall `blocked` |
| `implementing` or `rework` | a new implementation result | `verifying` |
| `verifying` | verification `pass` | `evaluating` |
| `verifying` | verification `fail` | `rework` |
| `evaluating` | outcome replay recommending `rework` | `rework` |
| `evaluating` | other valid outcome replay | `awaiting_acceptance` |
| `awaiting_acceptance` | `accept` | accept and activate next, or complete |
| `awaiting_acceptance` | `rework` | `rework` |
| `awaiting_acceptance` | `new_milestone` with a valid milestone | accept current, append it to the end, then activate the next pending milestone |
| `awaiting_acceptance` | `rollback` or `stop` | overall `blocked` |

Reject advancing from `needs_evidence` or `blocked`. Preserve accepted milestone packets unchanged when the next milestone activates.

- [ ] **Step 6: Implement status and summary projections**

`getMilestoneView` returns only the safe public projection:

```js
{
  status,
  currentMilestoneIndex,
  milestone: {
    id, title, outcome, accountableRole, acceptanceCriteria, status
  },
  stage,
  evidenceGaps,
  repairCount,
  targetedReviewCount,
  availableDecisions
}
```

`buildMilestoneSummary` must include `Goal Tunnel`, `Milestones`, `Evidence Gaps`, `Verification`, and `User Outcome Replay` headings and must distinguish approved requirements from new wishes.

- [ ] **Step 7: Run and commit**

```bash
rtk bun test tests/workflow-milestones.test.ts
rtk git add src/runtimes/omniskill/workflow-milestones.mjs tests/workflow-milestones.test.ts
rtk git diff --cached --check
rtk git commit -m "feat: add evidence-backed milestone state"
```

Expected: PASS.

### Task 3: Integrate milestone state into the reusable loop runtime

**Files:**
- Modify: `tests/loop-runtime.test.ts`
- Modify: `src/runtimes/omniskill/workflow-loop-runtime.mjs`

- [ ] **Step 1: Add a milestone workflow fixture helper**

In `tests/loop-runtime.test.ts`, add a helper that writes a temporary manifest with `loop.type: "milestone_based"`, the eight lifecycle step ids, and declared coordinator/implementer/verifier skills. Reuse `startInput` semantics from Task 2 and return both `workflowJson` and cleanup directory.

The step ids must be:

```ts
[
  "preparing",
  "planning",
  "awaiting_plan_approval",
  "implementing",
  "rework",
  "verifying",
  "evaluating",
  "awaiting_acceptance",
]
```

- [ ] **Step 2: Add failing end-to-end runtime tests**

Add tests proving:

```ts
test("runs two milestone cycles and resumes without repeating accepted work", async () => {
  // start with --input JSON
  // log input_packet -> advance
  // log role_output -> advance
  // log plan_decision approve -> advance
  // log implementation_result -> advance
  // log verification_result pass -> advance
  // log outcome_replay -> advance
  // log acceptance_decision accept -> advance
  // status now reports milestone 2 at preparing
  // status --latest selects the same incomplete run
  // milestone 1 remains accepted with its replay intact
});

test("persists evidence blocking, rework, and the one-repair limit", async () => {
  // unsupported high-risk role_output prevents advance
  // evidence_gap exposes needs_evidence in status
  // evidence_resolved returns to planning
  // failed verification routes to rework
  // a second repair_request fails plainly
});

test("rejects force advance for milestone runs", async () => {
  // advance --to implementing --force --reason ... must fail
  // expected message: Milestone runs cannot bypass lifecycle transitions
});
```

Use real `runRuntime` calls and inspect the persisted `state.json` plus `events.jsonl`; do not mock filesystem writes.

- [ ] **Step 3: Run tests and verify red**

```bash
rtk bun test tests/loop-runtime.test.ts --test-name-pattern "milestone"
```

Expected: FAIL because `startRun`, `logEventCommand`, `advanceRun`, and status output do not call the milestone module.

- [ ] **Step 4: Wire milestone start and packet persistence**

Import the five public functions from `./workflow-milestones.mjs`.

In `startRun`, when `context.manifest.loop?.type === "milestone_based"`:

```js
const input = await readJsonInput(context, options.input, options.inputFile, "start");
const milestoneState = createMilestoneState(input, now.toISOString());
Object.assign(state, {
  schemaVersion: "0.2",
  currentStepIndex: 0,
  currentStep: "preparing",
  milestone: milestoneState,
});
```

`readJsonInput` must reject both options together, resolve files relative to `context.cwd`, and produce these messages:

```text
start requires --input <json> or --input-file <path> for milestone-based loops
Pass only one of --input or --input-file
--input must be valid JSON
--input-file must contain valid JSON: <path>
```

In `logEventCommand`, read `--metadata-file` through the same helper, call `recordMilestoneEvent`, persist the updated `state.milestone`, and then append the event. Existing goal-based log behavior remains unchanged.

- [ ] **Step 5: Wire status, actions, transitions, and summaries**

For milestone runs:

- derive `state.currentStep` and `currentStepIndex` from `getMilestoneView(state.milestone).stage`;
- include `milestone: getMilestoneView(...)` in JSON status;
- print `Milestone`, `Stage`, `Evidence gaps`, and `Available decisions` in text status;
- make the `run_phase` action manual and label it `Prepared, not executed`;
- emit the exact expected event type for the current stage;
- call `advanceMilestoneState` instead of the fixed-step increment;
- disallow `advance --to` and `--force`;
- append `buildMilestoneSummary` to the mechanical summary;
- treat every non-`complete` milestone status as selectable by `--latest`.

Use this expected-event map when building actions:

```js
{
  preparing: "input_packet",
  planning: "role_output",
  awaiting_plan_approval: "plan_decision",
  implementing: "implementation_result",
  rework: "implementation_result",
  verifying: "verification_result",
  evaluating: "outcome_replay",
  awaiting_acceptance: "acceptance_decision",
}
```

Keep the existing goal-based branch byte-for-byte where practical so grilled-product-dev behavior remains compatible.

- [ ] **Step 6: Run direct runtime tests**

```bash
rtk bun test tests/workflow-milestones.test.ts tests/loop-runtime.test.ts
```

Expected: PASS for new milestone tests and all existing goal-based runtime tests.

- [ ] **Step 7: Commit**

```bash
rtk git add src/runtimes/omniskill/workflow-loop-runtime.mjs tests/loop-runtime.test.ts
rtk git diff --cached --check
rtk git commit -m "feat: run resumable milestone workflows"
```

### Task 4: Expose safe milestone packet files through the CLI

**Files:**
- Modify: `tests/cli.test.ts`
- Modify: `src/omniskill.ts`

- [ ] **Step 1: Add failing Commander forwarding tests**

Extend the existing loop CLI test to start a milestone fixture with `--input-file`, log a role packet with `--metadata-file`, and assert the direct runtime receives:

```ts
expect(args).toContain("--input-file");
expect(args).toContain(inputPath);
expect(args).toContain("--metadata-file");
expect(args).toContain(roleOutputPath);
```

Also assert help text contains both options only on their intended subcommands.

- [ ] **Step 2: Run and verify red**

```bash
rtk bun test tests/cli.test.ts --test-name-pattern "loop"
```

Expected: FAIL because Commander rejects the new options.

- [ ] **Step 3: Add CLI options and forwarding**

Extend `OmniskillLoopCommandOptions`:

```ts
input?: string;
inputFile?: string;
metadataFile?: string;
```

Add to `loop start`:

```ts
.option("--input <json>", "milestone goal tunnel and milestone map as JSON")
.option("--input-file <path>", "read milestone goal tunnel and milestone map from JSON")
```

Add to `loop log`:

```ts
.option("--metadata-file <path>", "read structured event metadata from JSON")
```

Forward all three in `buildLoopRuntimeArgs` with `appendStringOption`. Do not add them to dispatch or install commands.

- [ ] **Step 4: Run CLI and runtime tests**

```bash
rtk bun test tests/cli.test.ts tests/loop-runtime.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/omniskill.ts tests/cli.test.ts
rtk git diff --cached --check
rtk git commit -m "feat: accept milestone packet files"
```

### Task 5: Turn startup-team into the manual milestone workflow

**Files:**
- Modify: `tests/workflow-bundles.test.ts`
- Modify: `examples/teams/startup-team/workflow.json`
- Modify: `examples/teams/startup-team/skills/startup-goal/SKILL.md`
- Modify: `examples/teams/startup-team/README.md`

- [ ] **Step 1: Replace the startup-team contract assertions**

Update the startup-team test to expect version `0.5.0`, `loop.type === "milestone_based"`, and these steps:

```ts
expect(bundle.manifest.steps.map((step) => [step.id, step.skill, step.gate ?? null])).toEqual([
  ["preparing", "./skills/startup-goal", null],
  ["planning", "./skills/startup-goal", null],
  ["awaiting_plan_approval", "./skills/startup-goal", "human_approval"],
  ["implementing", "mattpocock:implement", null],
  ["rework", "mattpocock:implement", null],
  ["verifying", "catalog:qa-lead", null],
  ["evaluating", "./skills/startup-goal", null],
  ["awaiting_acceptance", "./skills/startup-goal", "human_approval"],
]);
```

Add assertions that the coordinator contains `Goal Tunnel`, `Input Packet`, `Output Packet`, `Evidence Ledger`, `User Outcome Replay`, `Prepared, not executed`, and `must not prescribe`. Assert it contains no automatic dispatch command.

- [ ] **Step 2: Run and verify red**

```bash
rtk bun test tests/workflow-bundles.test.ts --test-name-pattern "startup team entry skill"
```

Expected: FAIL on version, loop metadata, lifecycle steps, and skill headings.

- [ ] **Step 3: Update `workflow.json`**

Set version `0.5.0`. Add:

```json
"loop": {
  "script": "./loop.mjs",
  "state": "global",
  "execution": "action-only",
  "type": "milestone_based",
  "goal": "Move an approved startup goal through evidence-backed feature milestones.",
  "done_when": ["all_milestones_accepted"],
  "stop_when": ["human_stops", "critical_evidence_missing", "milestone_blocked"],
  "milestone": {
    "coordinator": "./skills/startup-goal",
    "implementer": "mattpocock:implement",
    "verifier": "catalog:qa-lead"
  }
}
```

Replace the current ten-step role sequence with the eight lifecycle steps from Step 1. Give every step a concrete instruction; both `implementing` and `rework` keep `"phase": "implementation"`. The `evaluating` instruction must tell the coordinator to prepare the accountable outcome role handoff rather than perform that role's content analysis.

- [ ] **Step 4: Rewrite the coordinator around interfaces and manual state**

Keep the skill concise. Its required headings are:

```markdown
## 1. Clarify and approve the goal tunnel
## 2. Decompose feature milestones
## 3. Prepare role input packets
## 4. Validate role output packets
## 5. Enforce evidence and approval gates
## 6. Prepare implementation and QA handoffs
## 7. Reconstruct and evaluate the user outcome
## 8. Carry accepted context forward
## Manual execution policy
## Loop limits
```

State explicitly:

```markdown
The coordinator controls direction, scope, packet interfaces, evidence quality,
state transitions, and human gates. It must not prescribe a role's framework,
tool, optional method, research process, or conclusion.
```

Document the exact input/output/evidence/outcome fields from Task 2. Require `Verified`, `Inferred`, and `Assumed` evidence classification. Preserve `Prepared, not executed`, disabled automatic launch, one repair, one targeted review, and human escalation.

- [ ] **Step 5: Document manual commands**

In `examples/teams/startup-team/README.md`, add a minimal `startup-goal-input.json` example and these commands:

```bash
omniskill loop start examples/teams/startup-team --input-file startup-goal-input.json --json
omniskill loop status examples/teams/startup-team --latest --json
omniskill loop log examples/teams/startup-team --run <run-id> --type <expected-event> --metadata-file <packet.json> --json
omniskill loop advance examples/teams/startup-team --run <run-id> --json
```

Explain both approval gates and the post-QA User Outcome Replay. Do not imply a role was launched.

- [ ] **Step 6: Run focused validation**

```bash
rtk bun test tests/workflow-bundles.test.ts --test-name-pattern "startup team"
rtk bun run dev -- validate examples/teams/startup-team
```

Expected: PASS and `valid: true`.

- [ ] **Step 7: Commit**

```bash
rtk git add examples/teams/startup-team/workflow.json examples/teams/startup-team/skills/startup-goal/SKILL.md examples/teams/startup-team/README.md tests/workflow-bundles.test.ts
rtk git diff --cached --check
rtk git commit -m "feat: stage startup goals by feature"
```

### Task 6: Make role methods optional and remove implementation overlap

**Files:**
- Modify: `tests/workflow-bundles.test.ts`
- Modify: `examples/workflows/{ceo,product-manager,web-design,cto,engineering-manager,founding-engineer,qa-lead}/skills/*/SKILL.md`
- Modify: `examples/workflows/{ceo,product-manager,web-design,cto,engineering-manager,founding-engineer,qa-lead}/workflow.json`
- Modify: the seven corresponding `workflow.lock.json` files

- [ ] **Step 1: Make the role contract test fail**

Replace mandatory-companion assertions with:

```ts
for (const contract of startupRoleContracts) {
  const skill = await readStartupRoleSkill(contract.role);
  expect(skill).toContain("## Inputs");
  expect(skill).toContain("## Outputs");
  expect(skill).toContain("## Optional Methods");
  expect(skill).toContain("## Domain Principles");
  expect(skill).toContain("## Escalate When");
  expect(skill).toContain("Evidence Ledger");
  expect(skill).not.toContain("## Required Companion Skills");
  expect(skill).not.toContain("If a companion skill is unavailable");
}
```

For each role manifest, assert `steps` contains only its local entry skill. For founding-engineer, assert the dependency list no longer contains `mattpocock:implement` and its skill contains `Do not edit files or run implementation commands`.

- [ ] **Step 2: Run and verify red**

```bash
rtk bun test tests/workflow-bundles.test.ts --test-name-pattern "canonical startup role skills|separates implementation framing|web-design"
```

Expected: FAIL on mandatory headings, unconditional step chains, and founding-engineer execution language.

- [ ] **Step 3: Rewrite each role skill to the shared interface**

Use this structure in all seven skills:

```markdown
## Inputs
- Approved goal tunnel and current milestone outcome.
- Decision required, constraints, permissions, and prior approved decisions.
- Available source and repository context.
- Expected artifact and acceptance criteria.

## Outputs
- Recommendation and alternatives considered.
- Evidence Ledger with Verified, Inferred, and Assumed claims.
- Risks, unresolved questions, verification method, and next action.

## Optional Methods
[Keep the existing companion skills, but say to use only when they materially help.]
Missing an optional method does not block the role.

## Domain Principles
[Keep concise role-specific judgment; do not prescribe a fixed sequence.]

## Escalate When
- The input is materially ambiguous or conflicts with an approved decision.
- A high-risk claim lacks reliable evidence.
- The requested output would expand scope or permissions.
```

Preserve role-specific output:

- CEO: decision, tradeoffs, reversibility, evidence-gathering move.
- Product manager: customer outcome, must-have scope, acceptance, sequencing.
- Web design: hierarchy, states, responsive/accessibility behavior; motion review only when motion changed.
- CTO: architecture decision, seams, technical risk, verification gate.
- Engineering manager: smallest shippable sequence, ownership, proportional quality gates.
- Founding engineer: read-only implementation frame, affected seams, test strategy, risks; no edits or implementation commands.
- QA lead: acceptance evidence, regression coverage, untested areas, residual risk.

- [ ] **Step 4: Collapse unconditional workflow steps**

Set each role workflow version to `0.2.0`. Keep every companion skill in `skills[]` as an available installed capability, but replace `steps[]` with one local entry step. For founding-engineer, remove `mattpocock:implement` from both `skills[]` and `steps[]`; startup-team already declares the sole implementation dependency.

- [ ] **Step 5: Refresh locks**

Run each command separately and inspect the diff after each:

```bash
rtk bun run dev -- lock examples/workflows/ceo
rtk bun run dev -- lock examples/workflows/product-manager
rtk bun run dev -- lock examples/workflows/web-design
rtk bun run dev -- lock examples/workflows/cto
rtk bun run dev -- lock examples/workflows/engineering-manager
rtk bun run dev -- lock examples/workflows/founding-engineer
rtk bun run dev -- lock examples/workflows/qa-lead
```

Expected: each lock records workflow version `0.2.0`; founding-engineer no longer locks `mattpocock:implement`.

- [ ] **Step 6: Validate all role bundles and tests**

```bash
rtk bun test tests/workflow-bundles.test.ts --test-name-pattern "canonical startup role skills|separates implementation framing|web-design|startup team"
rtk bun run dev -- validate examples/workflows/ceo
rtk bun run dev -- validate examples/workflows/product-manager
rtk bun run dev -- validate examples/workflows/web-design
rtk bun run dev -- validate examples/workflows/cto
rtk bun run dev -- validate examples/workflows/engineering-manager
rtk bun run dev -- validate examples/workflows/founding-engineer
rtk bun run dev -- validate examples/workflows/qa-lead
```

Expected: PASS for every command.

- [ ] **Step 7: Commit**

Stage only the seven role directories and the focused test:

```bash
rtk git add examples/workflows/ceo examples/workflows/product-manager examples/workflows/web-design examples/workflows/cto examples/workflows/engineering-manager examples/workflows/founding-engineer examples/workflows/qa-lead tests/workflow-bundles.test.ts
rtk git diff --cached --check
rtk git commit -m "refactor: keep startup role methods optional"
```

### Task 7: Synchronize public startup-team descriptions

**Files:**
- Modify: `README.md`
- Modify: `README.zh-Hant.md`
- Modify: `docs/landing-content.md`
- Modify: `docs/landing-content.zh-Hant.md`
- Modify: `landing/lib/landing-content.ts`
- Modify: `tests/readme.test.ts`
- Modify: `tests/landing-app.test.ts`

- [ ] **Step 1: Add failing public-contract assertions**

Require the English and Traditional Chinese surfaces to describe:

- one user-visible feature milestone at a time;
- evidence-backed planning before implementation;
- plan approval and post-verification acceptance;
- User Outcome Replay after QA;
- manual handoffs with no browser or CLI agent launch implication.

Add source assertions for these stable phrases:

```ts
expect(content).toContain("feature milestone");
expect(content).toContain("Evidence Ledger");
expect(content).toContain("User Outcome Replay");
```

The Traditional Chinese source should contain `功能里程碑`, `證據帳本`, and `使用者結果重演`.

- [ ] **Step 2: Run and verify red**

```bash
rtk bun test tests/readme.test.ts tests/landing-app.test.ts
```

Expected: FAIL because the current public copy ends at implementation and QA.

- [ ] **Step 3: Update copy without changing layout or components**

Patch only startup-team descriptions and ordered flow text. Preserve the current landing redesign structure, audience content, model-routing copy, links, and translations. Do not edit React components.

The canonical short description is:

```text
Break one approved startup goal into evidence-backed feature milestones, review
each plan before implementation, verify the result, and replay the user's
expectations, needs, wishes, and journey before acceptance.
```

Update the visible ordered path to:

```text
Prepare -> Plan -> Plan approval -> Implement -> Verify -> User Outcome Replay -> Feature acceptance
```

- [ ] **Step 4: Run public-contract tests**

```bash
rtk bun test tests/readme.test.ts tests/landing-app.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add README.md README.zh-Hant.md docs/landing-content.md docs/landing-content.zh-Hant.md landing/lib/landing-content.ts tests/readme.test.ts tests/landing-app.test.ts
rtk git diff --cached --check
rtk git commit -m "docs: explain evidence-backed startup milestones"
```

### Task 8: Run the release verification ladder

**Files:**
- No planned source changes.
- Use `work/` only for disposable smoke input and run state.

- [ ] **Step 1: Run focused tests**

```bash
rtk bun test tests/workflow-milestones.test.ts tests/loop-runtime.test.ts tests/workflow-bundles.test.ts tests/cli.test.ts tests/readme.test.ts tests/landing-app.test.ts
```

Expected: PASS.

- [ ] **Step 2: Validate and resolve the startup-team dependency graph**

```bash
rtk bun run dev -- validate examples/teams/startup-team
rtk bun run dev -- deps examples/teams/startup-team
```

Expected: validation reports `valid: true`; dependencies include optional role capabilities once and `mattpocock:implement` exactly once.

- [ ] **Step 3: Smoke the manual milestone lifecycle**

Create `work/startup-goal-milestone-smoke/input.json` with one milestone using the Task 2 start shape. Run:

```bash
rtk bun run dev -- loop start examples/teams/startup-team --home work/startup-goal-milestone-smoke/home --run smoke --input-file work/startup-goal-milestone-smoke/input.json --json
rtk bun run dev -- loop status examples/teams/startup-team --home work/startup-goal-milestone-smoke/home --run smoke --json
```

Expected: `status: active`, milestone id from the input, stage `preparing`, and only manual `Prepared, not executed` actions. Confirm no dispatch run directory or subprocess launch evidence is created.

- [ ] **Step 4: Build the packaged CLI**

```bash
rtk bun run build
rtk node dist/cli.js loop status examples/teams/startup-team --home work/startup-goal-milestone-smoke/home --run smoke --json
```

Expected: build passes and packaged status matches the dev CLI projection.

- [ ] **Step 5: Run the full repository gate**

```bash
rtk bun run check
```

Expected: Biome, typecheck, tests, and the 90% coverage gate pass.

- [ ] **Step 6: Inspect final scope**

```bash
rtk git status --short
rtk git log --oneline -8
```

Expected: implementation commits are limited to the files named by Tasks 1-7; pre-existing unrelated worktree changes remain untouched and unstaged.

## Execution Checkpoints

Pause for user review after Task 5 because the startup-team lifecycle becomes visible there. Pause again after Task 6 because role behavior and workflow versions change. Do not begin Task 7 if the user rejects either contract.

## Spec Coverage Check

- Goal tunnel, feature decomposition, and approval gates: Tasks 2, 3, and 5.
- Risk-based Evidence Ledger and source traceability: Tasks 2, 3, 5, and 6.
- Coordinator direction control without content control: Tasks 5 and 6.
- Optional role methods and no recursive skill hunting: Task 6.
- Founding-engineer framing versus sole `implement` execution: Tasks 5 and 6.
- Manual-first operation with disabled automatic dispatch: Tasks 3, 4, and 5.
- Resume, evidence gaps, rework, loop caps, and invalid transitions: Tasks 2 and 3.
- Post-QA User Outcome Replay and new-wish classification: Tasks 2, 3, 5, and 7.
- Public contract alignment and full verification: Tasks 7 and 8.

No approved design requirement is left without an implementation or verification task.
