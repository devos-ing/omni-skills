# Requirement Court Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the default hidden 3-bot goal approval flow with a visible requirement-first court: four voting role bots, a non-voting Judge, 3-of-4 approval, and a detailed requirement summary before worker execution.

**Architecture:** Keep `src/cli.ts` as the thin shell and move court behavior into `src/runtimes/goal-court/requirement-court.ts`. The manifest defines bot roles, models, and the 3-of-4 rule; the runtime deterministically creates visible discussion entries and Judge output from the draft requirement contract without calling live provider SDKs.

**Tech Stack:** Bun, TypeScript, Commander, @clack/prompts, picocolors, Zod, Biome.

---

## File Structure

- Modify `src/runtimes/goal-court/manifest.ts`: add the new role-bot defaults, `judge_bot` type, 3-of-4 decision rule, worker gate text, and legacy upgrade mapping.
- Modify `src/runtimes/goal-court/goal.ts`: keep contract drafting, but consume the new approval rule from the manifest.
- Create `src/runtimes/goal-court/requirement-court.ts`: build visible role-bot discussion entries, votes, Judge summary, and merged detailed requirement.
- Modify `src/runtimes/goal-court/index.ts`: export the requirement court module.
- Modify `src/cli.ts`: make `goal` print requirement discussion and Judge output instead of streaming to a worker by default.
- Modify `docs/architecture.md`: document the 4-bot plus Judge requirement-first flow.
- Modify `tests/manifest.test.ts`: assert the new bot roster, models, and 3-of-4 rule.
- Modify `tests/voting.test.ts`: assert 3-of-4 approval, 2-of-4 rejection, and Judge exclusion.
- Modify `tests/goal.test.ts`: assert drafted contracts inherit the new approval rule.
- Create `tests/requirement-court.test.ts`: assert visible discussion entries and Judge output.
- Modify `tests/cli.test.ts`: assert CLI discussion output and no default streaming from `goal`.

This workspace is not a git repository, so execution should skip commit steps and use verification output as the checkpoint record.

## Task 1: Manifest Defaults and Vote Rule

**Files:**
- Modify: `tests/manifest.test.ts`
- Modify: `tests/voting.test.ts`
- Modify: `tests/goal.test.ts`
- Modify: `src/runtimes/goal-court/manifest.ts`

- [ ] **Step 1: Update the manifest test for the new court roster**

Replace the first test in `tests/manifest.test.ts` with:

```ts
test("creates a default 4-bot requirement court with a non-voting Judge", () => {
  const manifest = createDefaultManifest();
  const parsed = ManifestSchema.parse(manifest);

  expect(parsed.kind).toBe("ai-work-runtime.goal-court");
  expect(parsed.deliberation.decisionRule.voters).toBe(4);
  expect(parsed.deliberation.decisionRule.requiredApprovals).toBe(3);
  expect(parsed.deliberation.decisionRule.voterIds).toEqual([
    "product_manager_bot",
    "project_manager_bot",
    "engineer_bot",
    "testing_bot",
  ]);
  expect(parsed.bots.map((bot) => bot.id)).toEqual([
    "requirements_brainstorm_bot",
    "goal_draft_bot",
    "product_manager_bot",
    "project_manager_bot",
    "engineer_bot",
    "testing_bot",
    "requirement_judge_bot",
  ]);
  expect(parsed.models.map((model) => model.id)).toEqual([
    "requirements_model",
    "draft_model",
    "product_manager_model",
    "project_manager_model",
    "engineer_model",
    "testing_model",
    "judge_model",
  ]);
  expect(parsed.bots.map((bot) => [bot.id, bot.model])).toEqual([
    ["requirements_brainstorm_bot", "requirements_model"],
    ["goal_draft_bot", "draft_model"],
    ["product_manager_bot", "product_manager_model"],
    ["project_manager_bot", "project_manager_model"],
    ["engineer_bot", "engineer_model"],
    ["testing_bot", "testing_model"],
    ["requirement_judge_bot", "judge_model"],
  ]);
  expect(parsed.bots.find((bot) => bot.id === "requirement_judge_bot")?.type).toBe("judge_bot");
});
```

- [ ] **Step 2: Update the legacy manifest expectation**

In the legacy manifest test, replace the expected models and bot/model pairs with:

```ts
expect(loaded.models.map((model) => model.id)).toEqual([
  "requirements_model",
  "draft_model",
  "product_manager_model",
  "project_manager_model",
  "engineer_model",
  "testing_model",
  "judge_model",
]);
expect(loaded.bots.map((bot) => [bot.id, bot.model])).toEqual([
  ["requirements_brainstorm_bot", "requirements_model"],
  ["goal_draft_bot", "draft_model"],
  ["product_manager_bot", "product_manager_model"],
  ["project_manager_bot", "project_manager_model"],
  ["engineer_bot", "engineer_model"],
  ["testing_bot", "testing_model"],
  ["requirement_judge_bot", "judge_model"],
]);
```

- [ ] **Step 3: Update voting tests for 3-of-4**

Replace the first voting test in `tests/voting.test.ts` with:

```ts
test("approves a requirement direction when at least 3 of 4 review bots approve", () => {
  const manifest = createDefaultManifest();

  const verdict = tallyVotes(
    [
      {
        botId: "product_manager_bot",
        vote: "approve",
        confidence: 0.9,
        reason: "Matches the human intent.",
        requiredChanges: [],
      },
      {
        botId: "project_manager_bot",
        vote: "approve",
        confidence: 0.8,
        reason: "The task can be planned.",
        requiredChanges: [],
      },
      {
        botId: "engineer_bot",
        vote: "approve",
        confidence: 0.8,
        reason: "The task is feasible.",
        requiredChanges: [],
      },
      {
        botId: "testing_bot",
        vote: "amend",
        confidence: 0.6,
        reason: "Evidence needs to be sharper.",
        requiredChanges: ["Add a concrete smoke verification artifact."],
      },
    ],
    manifest.deliberation.decisionRule,
  );

  expect(verdict.approved).toBe(true);
  expect(verdict.approvals).toBe(3);
  expect(verdict.requiredChanges).toEqual(["Add a concrete smoke verification artifact."]);
});
```

Add this rejection test:

```ts
test("rejects a requirement direction when only 2 of 4 review bots approve", () => {
  const manifest = createDefaultManifest();

  const verdict = tallyVotes(
    [
      {
        botId: "product_manager_bot",
        vote: "approve",
        confidence: 0.9,
        reason: "Matches intent.",
        requiredChanges: [],
      },
      {
        botId: "project_manager_bot",
        vote: "approve",
        confidence: 0.8,
        reason: "Can be planned.",
        requiredChanges: [],
      },
      {
        botId: "engineer_bot",
        vote: "amend",
        confidence: 0.5,
        reason: "Technical boundary is incomplete.",
        requiredChanges: ["Name the admin dashboard module in scope."],
      },
      {
        botId: "testing_bot",
        vote: "reject",
        confidence: 0.4,
        reason: "Success evidence is missing.",
        requiredChanges: ["Add observable acceptance criteria."],
      },
    ],
    manifest.deliberation.decisionRule,
  );

  expect(verdict.approved).toBe(false);
  expect(verdict.approvals).toBe(2);
  expect(verdict.requiredChanges).toEqual([
    "Name the admin dashboard module in scope.",
    "Add observable acceptance criteria.",
  ]);
});
```

Update the duplicate vote test bot IDs to `product_manager_bot`.

Add this Judge exclusion test:

```ts
test("rejects Judge votes because the Judge summarizes but does not vote", () => {
  const manifest = createDefaultManifest();

  expect(() =>
    tallyVotes(
      [
        {
          botId: "requirement_judge_bot",
          vote: "approve",
          confidence: 1,
          reason: "The Judge does not vote.",
          requiredChanges: [],
        },
      ],
      manifest.deliberation.decisionRule,
    ),
  ).toThrow("Unknown voter requirement_judge_bot");
});
```

- [ ] **Step 4: Update the goal contract approval rule test**

In `tests/goal.test.ts`, replace the approval expectations with:

```ts
expect(contract.approvalRule.goalDirectionPanel.requiredApprovals).toBe(3);
expect(contract.approvalRule.goalDirectionPanel.voters).toEqual([
  "product_manager_bot",
  "project_manager_bot",
  "engineer_bot",
  "testing_bot",
]);
```

- [ ] **Step 5: Run focused tests and confirm they fail**

Run:

```bash
rtk bun test tests/manifest.test.ts tests/voting.test.ts tests/goal.test.ts
```

Expected: failures showing the manifest still returns 3 voters, old bot IDs, old model IDs, and a 2 approval rule.

- [ ] **Step 6: Update manifest defaults**

In `src/runtimes/goal-court/manifest.ts`, update `BotSchema.type`:

```ts
type: z.enum(["brainstorm_bot", "drafting_bot", "review_bot", "judge_bot"]),
```

Replace `DEFAULT_MODEL_CONFIGS` with:

```ts
const DEFAULT_MODEL_CONFIGS = [
  {
    id: "requirements_model",
    provider: "configurable",
    name: "requirements-model",
    purpose: "Clarify vague human requests before the requirement court begins.",
    temperature: 0.2,
  },
  {
    id: "draft_model",
    provider: "configurable",
    name: "requirement-draft-model",
    purpose: "Draft structured requirement contracts from clarified user requests.",
    temperature: 0.2,
  },
  {
    id: "product_manager_model",
    provider: "configurable",
    name: "product-manager-review-model",
    purpose: "Review requirement direction for user value, product intent, and scope fit.",
    temperature: 0.1,
  },
  {
    id: "project_manager_model",
    provider: "configurable",
    name: "project-manager-review-model",
    purpose: "Review requirement direction for planning, sequencing, dependencies, and delivery risk.",
    temperature: 0.1,
  },
  {
    id: "engineer_model",
    provider: "configurable",
    name: "engineer-review-model",
    purpose: "Review technical feasibility, execution boundaries, and implementation risk.",
    temperature: 0.1,
  },
  {
    id: "testing_model",
    provider: "configurable",
    name: "testing-review-model",
    purpose: "Review acceptance criteria, edge cases, evidence requirements, and failure conditions.",
    temperature: 0.1,
  },
  {
    id: "judge_model",
    provider: "configurable",
    name: "requirement-judge-model",
    purpose: "Summarize role-bot discussion, tally votes, and merge approved feedback into one detailed requirement.",
    temperature: 0.1,
  },
] satisfies z.infer<typeof ModelConfigSchema>[];
```

Replace `DEFAULT_BOT_MODEL_IDS` with:

```ts
const DEFAULT_BOT_MODEL_IDS: Record<string, string> = {
  requirements_brainstorm_bot: "requirements_model",
  goal_draft_bot: "draft_model",
  product_manager_bot: "product_manager_model",
  project_manager_bot: "project_manager_model",
  engineer_bot: "engineer_model",
  testing_bot: "testing_model",
  requirement_judge_bot: "judge_model",
  product_bot: "product_manager_model",
  engineering_bot: "engineer_model",
  verification_bot: "testing_model",
};
```

In `createDefaultManifest`, replace `voterIds` with:

```ts
const voterIds = [
  "product_manager_bot",
  "project_manager_bot",
  "engineer_bot",
  "testing_bot",
];
```

Update `deliberation`:

```ts
deliberation: {
  panelId: "requirement_court",
  purpose:
    "Decide whether the proposed requirement direction is clear, valuable, feasible, plannable, and verifiable.",
  maxRounds: 2,
  stages: [
    { id: "brainstorm", actor: "requirements_brainstorm_bot", output: "clarifying_questions" },
    { id: "draft", actor: "goal_draft_bot", output: "requirement_contract_draft" },
    { id: "discuss", actor: "requirement_court", output: "role_bot_discussion" },
    { id: "vote", actor: "requirement_court", output: "votes" },
    { id: "judge", actor: "requirement_judge_bot", output: "judge_summary" },
    { id: "human_confirm", actor: "human_owner", output: "direction_confirmation" },
  ],
  decisionRule: {
    voters: 4,
    requiredApprovals: 3,
    voterIds,
    allowAbstain: false,
    tieBreaker: "human_owner",
    humanFinalApproval: true,
  },
},
```

Replace the old `product_bot`, `engineering_bot`, and `verification_bot` objects in the `bots` array with the five role objects from the approved spec:

```ts
{
  id: "product_manager_bot",
  displayName: "Product Manager Bot",
  type: "review_bot",
  model: "product_manager_model",
  temperature: 0.1,
  panel: "requirement_court",
  skills: ["intent_alignment", "scope_control"],
  instruction:
    "Discuss whether the requirement preserves the human's product intent, user value, and scope boundary before voting.",
  approvalConditions: [
    "The requirement preserves the user's stated intent.",
    "The expected user or business outcome is clear.",
    "The requirement does not add unnecessary product scope.",
  ],
  rejectOrAmendConditions: [
    "The requirement optimizes for a different outcome than the user asked for.",
    "The requirement is too broad for a single agent task.",
    "The requirement hides an important product decision inside implementation details.",
  ],
},
{
  id: "project_manager_bot",
  displayName: "Project Manager Bot",
  type: "review_bot",
  model: "project_manager_model",
  temperature: 0.1,
  panel: "requirement_court",
  skills: ["scope_control", "risk_review"],
  instruction:
    "Discuss whether the requirement can be planned, sequenced, tracked, and delivered as a manageable unit of work before voting.",
  approvalConditions: [
    "The delivery boundary is clear.",
    "Dependencies and sequencing risks are named or intentionally deferred.",
    "The requirement can become a manageable implementation brief.",
  ],
  rejectOrAmendConditions: [
    "The requirement combines multiple independent projects.",
    "The requirement omits a major dependency needed to plan the work.",
    "The requirement has no clear owner confirmation gate.",
  ],
},
{
  id: "engineer_bot",
  displayName: "Engineer Bot",
  type: "review_bot",
  model: "engineer_model",
  temperature: 0.1,
  panel: "requirement_court",
  skills: ["feasibility_review", "scope_control", "risk_review"],
  instruction:
    "Discuss whether the requirement is technically feasible and bounded enough for an implementation agent before voting.",
  approvalConditions: [
    "The technical boundary is clear enough to begin.",
    "Major dependencies and constraints are named or intentionally deferred.",
    "Known risky operations are called out before execution.",
  ],
  rejectOrAmendConditions: [
    "The requirement needs unknown systems or credentials without saying so.",
    "The requirement forces large unstated architecture choices.",
    "The requirement is too ambiguous to map to code changes.",
  ],
},
{
  id: "testing_bot",
  displayName: "Testing Bot",
  type: "review_bot",
  model: "testing_model",
  temperature: 0.1,
  panel: "requirement_court",
  skills: ["verification_design", "risk_review"],
  instruction:
    "Discuss whether the requirement has observable acceptance criteria, edge cases, and evidence from a tester's perspective before voting.",
  approvalConditions: [
    "Acceptance criteria are observable.",
    "Important edge cases are named.",
    "Required evidence can prove the user's request is satisfied.",
  ],
  rejectOrAmendConditions: [
    "The requirement uses vague success language without evidence.",
    "There is no verification path.",
    "The evidence can pass while the user's actual request remains unsatisfied.",
  ],
},
{
  id: "requirement_judge_bot",
  displayName: "Requirement Judge Bot",
  type: "judge_bot",
  model: "judge_model",
  temperature: 0.1,
  skills: ["goal_rewrite", "intent_alignment", "scope_control", "verification_design"],
  instruction:
    "Summarize the four voting bot discussions, tally the 3-of-4 approval rule, and merge approved feedback into one detailed requirement for human confirmation. The Judge does not vote.",
  outputs: ["discussion_summary", "vote_tally", "judge_verdict", "detailed_requirement"],
},
```

Update `workerExecutionGate.mayStartWhen`:

```ts
mayStartWhen: [
  "requirement_court.approvals >= 3",
  "human_owner.approved == true",
  "goal_contract.status == locked",
],
```

Update `defaultGoalTemplate.approvalRule.goalDirectionPanel` to use `requiredApprovals: 3` and `voters: voterIds`.

- [ ] **Step 7: Add legacy default manifest upgrade**

In `upgradeManifestInput`, after the `models` fallback, add:

```ts
if (Array.isArray(manifest.bots) && isLegacyDefaultCourt(manifest.bots)) {
  const defaultManifest = createDefaultManifest({
    name: isRecord(manifest.metadata) && typeof manifest.metadata.name === "string"
      ? manifest.metadata.name
      : undefined,
  });
  return {
    ...defaultManifest,
    ...manifest,
    models: defaultManifest.models,
    deliberation: defaultManifest.deliberation,
    bots: defaultManifest.bots,
    workerExecutionGate: defaultManifest.workerExecutionGate,
    defaultGoalTemplate: defaultManifest.defaultGoalTemplate,
  };
}
```

Add this helper above `isRecord`:

```ts
function isLegacyDefaultCourt(bots: unknown[]): boolean {
  const ids = new Set(
    bots
      .filter(isRecord)
      .map((bot) => bot.id)
      .filter((id): id is string => typeof id === "string"),
  );

  return ids.has("product_bot") && ids.has("engineering_bot") && ids.has("verification_bot");
}
```

- [ ] **Step 8: Run focused tests and confirm they pass**

Run:

```bash
rtk bun test tests/manifest.test.ts tests/voting.test.ts tests/goal.test.ts
```

Expected: all focused tests pass.

## Task 2: Requirement Court Runtime

**Files:**
- Create: `tests/requirement-court.test.ts`
- Create: `src/runtimes/goal-court/requirement-court.ts`
- Modify: `src/runtimes/goal-court/index.ts`

- [ ] **Step 1: Write tests for visible discussion and Judge output**

Create `tests/requirement-court.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { draftGoalContract } from "../src/runtimes/goal-court/goal";
import { createDefaultManifest } from "../src/runtimes/goal-court/manifest";
import { runRequirementCourt } from "../src/runtimes/goal-court/requirement-court";

describe("requirement court", () => {
  test("creates visible role-bot discussion entries before the Judge summary", () => {
    const manifest = createDefaultManifest();
    const contract = draftGoalContract("Add CSV import to admin dashboard", { manifest });

    const result = runRequirementCourt(contract, { manifest });

    expect(result.discussion.map((entry) => entry.botId)).toEqual([
      "product_manager_bot",
      "project_manager_bot",
      "engineer_bot",
      "testing_bot",
    ]);
    expect(result.discussion.map((entry) => entry.line)).toEqual([
      expect.stringContaining("product_manager_bot: I think"),
      expect.stringContaining("project_manager_bot: I think"),
      expect.stringContaining("engineer_bot: I think"),
      expect.stringContaining("testing_bot: I think"),
    ]);
    expect(result.verdict.approved).toBe(true);
    expect(result.judge.botId).toBe("requirement_judge_bot");
    expect(result.judge.summary).toContain("Approvals: 4/4");
    expect(result.detailedRequirement.title).toBe("Add CSV import to admin dashboard");
  });

  test("uses the manifest vote rule and does not count the Judge as a voter", () => {
    const manifest = createDefaultManifest();
    const contract = draftGoalContract("Add CSV import to admin dashboard", { manifest });

    const result = runRequirementCourt(contract, { manifest });

    expect(result.votes.map((vote) => vote.botId)).toEqual([
      "product_manager_bot",
      "project_manager_bot",
      "engineer_bot",
      "testing_bot",
    ]);
    expect(result.votes.some((vote) => vote.botId === "requirement_judge_bot")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the new test and confirm it fails**

Run:

```bash
rtk bun test tests/requirement-court.test.ts
```

Expected: fail because `src/runtimes/goal-court/requirement-court.ts` does not exist.

- [ ] **Step 3: Implement the requirement court module**

Create `src/runtimes/goal-court/requirement-court.ts`:

```ts
import type { GoalContract } from "./goal";
import type { Manifest } from "./manifest";
import { type ReviewVote, tallyVotes, type VoteVerdict } from "./voting";

export interface RequirementDiscussionEntry {
  botId: string;
  displayName: string;
  role: string;
  message: string;
  line: string;
  vote: ReviewVote["vote"];
  confidence: number;
  requiredChanges: string[];
}

export interface RequirementJudgeResult {
  botId: "requirement_judge_bot";
  summary: string;
  verdict: "approved" | "not approved";
}

export interface DetailedRequirement {
  title: string;
  intent: string;
  include: string[];
  exclude: string[];
  acceptanceCriteria: string[];
  evidenceRequired: string[];
  risks: string[];
  openQuestions: string[];
}

export interface RequirementCourtResult {
  rawRequest: string;
  clarifiedRequest: string;
  draft: GoalContract;
  discussion: RequirementDiscussionEntry[];
  votes: ReviewVote[];
  verdict: VoteVerdict;
  judge: RequirementJudgeResult;
  detailedRequirement: DetailedRequirement;
  humanConfirmation: "pending";
}

export interface RunRequirementCourtInput {
  manifest: Manifest;
}

const ROLE_MESSAGES: Record<string, (contract: GoalContract) => string> = {
  product_manager_bot: (contract) =>
    `I think this requirement preserves the user's product intent: ${contract.intent}. Keep the outcome explicit and avoid expanding beyond the requested workflow.`,
  project_manager_bot: (contract) =>
    `I think this can become a manageable unit of work if the delivery boundary stays tied to: ${contract.title}. Dependencies and completion evidence should stay visible.`,
  engineer_bot: (contract) =>
    `I think the requirement is feasible if the worker keeps the technical boundary aligned to: ${contract.title}. Large architecture choices should be raised before execution.`,
  testing_bot: (contract) =>
    `I think this needs observable acceptance criteria and evidence for: ${contract.title}. Edge cases and smoke verification should be named before work starts.`,
};

const ROLE_LABELS: Record<string, string> = {
  product_manager_bot: "product",
  project_manager_bot: "project",
  engineer_bot: "engineering",
  testing_bot: "testing",
};

export function runRequirementCourt(
  contract: GoalContract,
  input: RunRequirementCourtInput,
): RequirementCourtResult {
  const discussion = input.manifest.deliberation.decisionRule.voterIds.map((botId) =>
    createDiscussionEntry(botId, contract, input.manifest),
  );
  const votes = discussion.map(toVote);
  const verdict = tallyVotes(votes, input.manifest.deliberation.decisionRule);
  const judge = createJudgeResult(verdict, input.manifest.deliberation.decisionRule.voters);

  return {
    rawRequest: contract.rawRequest,
    clarifiedRequest: contract.intent,
    draft: contract,
    discussion,
    votes,
    verdict,
    judge,
    detailedRequirement: {
      title: contract.title,
      intent: contract.intent,
      include: contract.scope.include,
      exclude: contract.scope.exclude,
      acceptanceCriteria: contract.acceptanceCriteria,
      evidenceRequired: contract.evidenceRequired,
      risks: contract.risks,
      openQuestions: contract.openQuestions,
    },
    humanConfirmation: "pending",
  };
}

function createDiscussionEntry(
  botId: string,
  contract: GoalContract,
  manifest: Manifest,
): RequirementDiscussionEntry {
  const bot = manifest.bots.find((candidate) => candidate.id === botId);
  if (!bot) {
    throw new Error(`Missing requirement court bot ${botId}`);
  }

  const messageFactory = ROLE_MESSAGES[botId];
  if (!messageFactory) {
    throw new Error(`Missing discussion message factory for ${botId}`);
  }

  const message = messageFactory(contract);

  return {
    botId,
    displayName: bot.displayName,
    role: ROLE_LABELS[botId] ?? "review",
    message,
    line: `${botId}: ${message}`,
    vote: "approve",
    confidence: 0.8,
    requiredChanges: [],
  };
}

function toVote(entry: RequirementDiscussionEntry): ReviewVote {
  return {
    botId: entry.botId,
    vote: entry.vote,
    confidence: entry.confidence,
    reason: entry.message,
    requiredChanges: entry.requiredChanges,
  };
}

function createJudgeResult(verdict: VoteVerdict, voterCount: number): RequirementJudgeResult {
  const status = verdict.approved ? "approved" : "not approved";
  const changes =
    verdict.requiredChanges.length > 0
      ? ` Required changes: ${verdict.requiredChanges.join("; ")}.`
      : "";

  return {
    botId: "requirement_judge_bot",
    summary: `Approvals: ${verdict.approvals}/${voterCount}. Verdict: ${status}.${changes}`,
    verdict: status,
  };
}
```

- [ ] **Step 4: Export the module**

Add this line to `src/runtimes/goal-court/index.ts`:

```ts
export * from "./requirement-court";
```

- [ ] **Step 5: Run the requirement court test**

Run:

```bash
rtk bun test tests/requirement-court.test.ts
```

Expected: pass.

## Task 3: CLI Requirement Discussion Output

**Files:**
- Modify: `tests/cli.test.ts`
- Modify: `src/cli.ts`

- [ ] **Step 1: Replace streaming expectations with requirement-court expectations**

In `tests/cli.test.ts`, replace the test named `goal streams a prepared contract through the manifest default worker` with:

```ts
test("goal prints requirement court discussion and does not stream by default", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "goal-court-cli-"));
  const logs: string[] = [];
  const invocations: CliInvocation[] = [];
  const originalLog = console.log;
  const streamRunner: CliStreamRunner = async function* (invocation) {
    invocations.push(invocation);
    yield { type: "start", invocation };
    yield { type: "stdout", chunk: "model started" };
    yield { type: "exit", exitCode: 0 };
  };

  console.log = (...values: unknown[]) => {
    logs.push(values.join(" "));
  };

  try {
    await buildProgram({ cwd: rootDir, streamRunner }).parseAsync(
      ["onboard", "--dir", ".", "--name", "CLI Court", "--yes"],
      { from: "user" },
    );

    await buildProgram({ cwd: rootDir, streamRunner }).parseAsync(
      ["goal", "Add", "CSV", "import", "to", "admin", "dashboard"],
      { from: "user" },
    );

    expect(logs).toContain("Requirement discussion");
    expect(logs.some((line) => line.includes("product_manager_bot: I think"))).toBe(true);
    expect(logs.some((line) => line.includes("project_manager_bot: I think"))).toBe(true);
    expect(logs.some((line) => line.includes("engineer_bot: I think"))).toBe(true);
    expect(logs.some((line) => line.includes("testing_bot: I think"))).toBe(true);
    expect(logs).toContain("Judge summary");
    expect(logs.some((line) => line.includes("Approvals: 4/4"))).toBe(true);
    expect(logs).toContain("Detailed requirement");
    expect(logs.some((line) => line.includes("Title: Add CSV import to admin dashboard"))).toBe(
      true,
    );
    expect(invocations).toEqual([]);
  } finally {
    console.log = originalLog;
    await rm(rootDir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Update clarification test to expect discussion after custom answers**

In `goal asks for custom clarification answers before streaming unclear requests`, rename the test to:

```ts
test("goal asks for custom clarification answers before requirement court discussion", async () => {
```

Replace the post-command expectations with:

```ts
expect(logs.some((line) => line.includes("Needs clarification"))).toBe(true);
expect(logs).toContain("Requirement discussion");
expect(logs.some((line) => line.includes("engineer_bot: I think"))).toBe(true);
expect(logs.some((line) => line.includes("Create an admin dashboard CSV importer"))).toBe(true);
expect(invocations).toEqual([]);
```

- [ ] **Step 3: Replace stream-goal alias expectations**

In `stream-goal remains a compatibility alias for a named manifest worker`, rename the test to:

```ts
test("stream-goal remains a compatibility alias for requirement discussion", async () => {
```

Replace the expectations with:

```ts
expect(logs).toContain("Requirement discussion");
expect(logs.some((line) => line.includes("testing_bot: I think"))).toBe(true);
expect(invocations).toEqual([]);
```

- [ ] **Step 4: Remove worker failure and neutral stream tests from goal behavior**

Delete these two tests from `tests/cli.test.ts`:

```ts
test("goal marks the process failed when the worker exits non-zero", async () => {
```

```ts
test("goal prints worker output as neutral chat lines", async () => {
```

The stream runner already has coverage in `tests/stream-runner.test.ts`, and `goal` no longer starts a worker by default.

- [ ] **Step 5: Run CLI tests and confirm they fail**

Run:

```bash
rtk bun test tests/cli.test.ts
```

Expected: fail because `goal` still streams through a worker and does not print requirement court output.

- [ ] **Step 6: Update CLI imports**

In `src/cli.ts`, add `runRequirementCourt` to the runtime import:

```ts
  runRequirementCourt,
```

Remove unused streaming imports if Biome reports them after the behavior change:

```ts
  type CliStreamEvent,
```

- [ ] **Step 7: Replace worker streaming in `runGoalFlow`**

In `src/cli.ts`, replace both calls to:

```ts
await streamPreparedGoal(clarifiedDiscussion.contract, manifest, input);
```

and:

```ts
await streamPreparedGoal(preparedDiscussion.contract, manifest, input);
```

with:

```ts
printRequirementCourtResult(runRequirementCourt(clarifiedDiscussion.contract, { manifest }));
```

and:

```ts
printRequirementCourtResult(runRequirementCourt(preparedDiscussion.contract, { manifest }));
```

- [ ] **Step 8: Add requirement court printing helpers**

Add this import near the runtime imports:

```ts
import type { RequirementCourtResult } from "./runtimes/goal-court";
```

Add this helper near `runGoalFlow`:

```ts
function printRequirementCourtResult(result: RequirementCourtResult): void {
  console.log(pc.cyan("Requirement discussion"));
  for (const entry of result.discussion) {
    console.log(entry.line);
  }

  console.log("");
  console.log(pc.cyan("Judge summary"));
  console.log(result.judge.summary);

  console.log("");
  console.log(pc.cyan("Detailed requirement"));
  console.log(`Title: ${result.detailedRequirement.title}`);
  console.log(`Intent: ${result.detailedRequirement.intent}`);
  console.log(`Human confirmation: ${result.humanConfirmation}`);
}
```

- [ ] **Step 9: Keep stream helpers compiling**

Leave `streamPreparedGoal`, `createStreamPrinter`, `selectManifestWorkerAgent`, and `formatGoalContractForWorker` in `src/cli.ts` for the next explicit execution command unless TypeScript or Biome flags unused imports. If Biome flags dead code, move these helpers behind a new internal `executePreparedGoal` function and leave it unexported.

- [ ] **Step 10: Run CLI tests**

Run:

```bash
rtk bun test tests/cli.test.ts
```

Expected: pass.

## Task 4: Documentation and Smoke Verification

**Files:**
- Modify: `docs/architecture.md`

- [ ] **Step 1: Update architecture text**

In `docs/architecture.md`, replace references to `3-bot / 2-approval` with:

```text
4-bot / 3-approval requirement court plus a non-voting Judge
```

Replace the flow block with:

```text
Human request
  -> CLI
  -> goal-court runtime
  -> requirements brainstorm
  -> ask human for details when unclear
  -> Product Manager, Project Manager, Engineer, and Testing bots discuss
  -> visible role-bot discussion is printed
  -> 3 of 4 voting bots approve the direction
  -> Requirement Judge summarizes and merges one detailed requirement
  -> human confirms the direction
  -> worker adapter execution remains gated
  -> evidence is collected when execution begins
  -> verdict
```

- [ ] **Step 2: Run full verification**

Run:

```bash
rtk bun run check
```

Expected: Biome passes, TypeScript passes, test coverage passes at or above 90%.

- [ ] **Step 3: Run CLI smoke checks**

Run:

```bash
rtk bun run dev -- onboard --dir work/smoke-requirement-court --name "Requirement Court Smoke" --yes
rtk bun run dev -- bots --manifest work/smoke-requirement-court/.goal-court/manifest.json
rtk bun run dev -- goal "Add CSV import to admin dashboard"
```

Expected:

- onboarding creates `.goal-court/manifest.json`
- `bots` lists `product_manager_bot`, `project_manager_bot`, `engineer_bot`, `testing_bot`, and `requirement_judge_bot`
- `goal` prints `Requirement discussion`, four bot lines, `Judge summary`, and `Detailed requirement`
- `goal` does not print `Streaming goal with`

## Self-Review Checklist

- Spec coverage: tasks cover the new role roster, visible discussion transcript, 3-of-4 voting, non-voting Judge, requirement summary, human confirmation pending state, default non-execution from `goal`, docs, and verification.
- Placeholder scan: no open placeholders are intentionally left in the plan.
- Type consistency: `RequirementCourtResult`, `RequirementDiscussionEntry`, `RequirementJudgeResult`, `DetailedRequirement`, and `runRequirementCourt` are introduced in Task 2 before CLI usage in Task 3.
- Scope control: no live Codex, Claude, GitHub Copilot, or provider SDK calls are added to core runtime.
