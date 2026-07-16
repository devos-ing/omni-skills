import { describe, expect, test } from "bun:test";
import {
  advanceMilestoneState,
  buildMilestoneSummary,
  createMilestoneState,
  getMilestoneView,
  recordMilestoneEvent,
} from "../src/runtimes/omniskill/workflow-milestones.mjs";

const NOW = "2026-07-16T00:00:00.000Z";
const input = {
  goalTunnel: {
    goal: "Improve onboarding",
    user: "A new founder",
    problem: "The first action is unclear",
    outcome: "The founder completes a useful first action",
    scope: ["onboarding"],
    nonGoals: ["billing"],
    constraints: ["manual execution"],
    successCriteria: ["first action completes"],
    assumptions: [],
  },
  milestones: [
    {
      id: "copy",
      title: "Clarify copy",
      outcome: "The next action is clear",
      accountableRole: "product-manager",
      dependencies: [],
      acceptanceCriteria: ["next action is explicit"],
    },
    {
      id: "journey",
      title: "Verify journey",
      outcome: "The first journey completes",
      accountableRole: "qa-lead",
      dependencies: ["copy"],
      acceptanceCriteria: ["journey has evidence"],
    },
  ],
};

const inputPacket = {
  featureOutcome: "The next action is clear",
  sourceContext: ["approved brief"],
  constraints: ["manual execution"],
  permissions: ["read"],
  decision: "Choose copy",
  expectedArtifact: "Plan",
  acceptanceCriteria: ["next action is explicit"],
  priorDecisions: [],
  accountableRole: "product-manager",
};

const roleOutput = {
  role: "product-manager",
  recommendation: "Lead with the first action",
  alternatives: ["Long tutorial"],
  evidence: [
    {
      claim: "Current copy is unclear",
      classification: "verified",
      risk: "high",
      source: "approved brief",
      observedAt: "2026-07-16",
    },
  ],
  risks: [],
  unresolvedQuestions: [],
  verificationMethod: "Replay onboarding",
  nextAction: "Approve plan",
};

const implementationResult = {
  summary: "Changed copy",
  changedFiles: ["a.ts"],
  verificationCommands: ["bun test"],
};

const outcomeReplay = {
  user: "A new founder",
  expectations: [
    {
      original: "See the next action",
      originalEvidence: "brief",
      status: "met",
      resultEvidence: "QA",
      gapType: "approved_requirement",
    },
  ],
  needs: [
    {
      original: "Complete first action",
      originalEvidence: "brief",
      status: "met",
      resultEvidence: "QA",
      gapType: "none",
    },
  ],
  wishes: [
    {
      original: "Tutorial",
      originalEvidence: "interview",
      status: "unmet",
      resultEvidence: "out of scope",
      gapType: "new_wish",
    },
  ],
  steps: [{ expected: "Start", actual: "Started", status: "met", resultEvidence: "QA" }],
  recommendation: "accept",
};

function advanceToPlanApproval(
  state: ReturnType<typeof createMilestoneState>,
  packet = inputPacket,
  output = roleOutput,
) {
  state = recordMilestoneEvent(state, { type: "input_packet", metadata: packet });
  state = advanceMilestoneState(state, NOW);
  state = recordMilestoneEvent(state, { type: "role_output", metadata: output });
  return advanceMilestoneState(state, NOW);
}

function advanceToAcceptance(state: ReturnType<typeof createMilestoneState>) {
  state = advanceToPlanApproval(state);
  state = recordMilestoneEvent(state, {
    type: "plan_decision",
    metadata: { decision: "approve", approvedBy: "human" },
  });
  state = advanceMilestoneState(state, NOW);
  state = recordMilestoneEvent(state, {
    type: "implementation_result",
    metadata: implementationResult,
  });
  state = advanceMilestoneState(state, NOW);
  state = recordMilestoneEvent(state, {
    type: "verification_result",
    metadata: { result: "pass", evidence: ["pass"], residualRisk: [] },
  });
  state = advanceMilestoneState(state, NOW);
  state = recordMilestoneEvent(state, { type: "outcome_replay", metadata: outcomeReplay });
  return advanceMilestoneState(state, NOW);
}

describe("workflow milestones", () => {
  test("starts one ordered milestone and preserves the goal tunnel", () => {
    const state = createMilestoneState(input, NOW);
    expect(state.schemaVersion).toBe("0.2");
    expect(state.milestones.map((item: { status: string }) => item.status)).toEqual([
      "active",
      "pending",
    ]);
    expect(getMilestoneView(state)).toMatchObject({
      stage: "preparing",
      milestone: { id: "copy" },
    });
  });

  test("blocks unsupported high-risk claims before plan approval", () => {
    let state = createMilestoneState(input, NOW);
    state = recordMilestoneEvent(state, { type: "input_packet", metadata: inputPacket });
    state = advanceMilestoneState(state, NOW);
    state = recordMilestoneEvent(state, {
      type: "role_output",
      metadata: {
        ...roleOutput,
        evidence: [
          {
            claim: "Users understand the copy",
            classification: "assumed",
            risk: "high",
            consequence: "Onboarding remains unclear",
            validationAction: "Replay onboarding",
          },
        ],
      },
    });
    expect(() => advanceMilestoneState(state, NOW)).toThrow(
      "High-risk claims must be verified before plan approval",
    );
  });

  test("allows only one repair and one targeted second review", () => {
    let state = createMilestoneState(input, NOW);
    state = recordMilestoneEvent(state, { type: "repair_request", metadata: { reason: "shape" } });
    expect(() =>
      recordMilestoneEvent(state, { type: "repair_request", metadata: { reason: "again" } }),
    ).toThrow("Only one output repair is allowed per milestone");
    state = recordMilestoneEvent(state, {
      type: "targeted_review",
      metadata: { reason: "conflict" },
    });
    expect(() =>
      recordMilestoneEvent(state, { type: "targeted_review", metadata: { reason: "again" } }),
    ).toThrow("Only one targeted second review is allowed per milestone");
  });

  test("advances accepted work and retains the user outcome replay", () => {
    let state = createMilestoneState(input, NOW);
    const events: Array<Parameters<typeof recordMilestoneEvent>[1]> = [
      { type: "input_packet", metadata: inputPacket },
      { type: "role_output", metadata: roleOutput },
      { type: "plan_decision", metadata: { decision: "approve", approvedBy: "human" } },
      {
        type: "implementation_result",
        metadata: implementationResult,
      },
      {
        type: "verification_result",
        metadata: { result: "pass", evidence: ["pass"], residualRisk: [] },
      },
      {
        type: "outcome_replay",
        metadata: outcomeReplay,
      },
      { type: "acceptance_decision", metadata: { decision: "accept", approvedBy: "human" } },
    ];
    for (const event of events) {
      state = recordMilestoneEvent(state, event);
      state = advanceMilestoneState(state, NOW);
    }
    expect(state.milestones[0]).toMatchObject({ status: "accepted" });
    expect(state.milestones[0]?.outcomeReplay).toMatchObject({ needs: [{ status: "met" }] });
    expect(getMilestoneView(state)).toMatchObject({
      stage: "preparing",
      milestone: { id: "journey" },
    });
  });

  test("enforces stage events and persists evidence and scope gates", () => {
    let state = createMilestoneState(input, NOW);
    expect(() =>
      recordMilestoneEvent(state, { type: "role_output", metadata: roleOutput }),
    ).toThrow("role_output is not allowed during preparing");

    state = recordMilestoneEvent(state, {
      type: "evidence_gap",
      metadata: { name: "founder interviews", critical: true, reason: "Source unavailable" },
    });
    expect(getMilestoneView(state)).toMatchObject({
      status: "needs_evidence",
      evidenceGaps: [{ name: "founder interviews", critical: true }],
    });
    expect(() => advanceMilestoneState(state, NOW)).toThrow(
      "Cannot advance milestone run with status needs_evidence",
    );

    state = recordMilestoneEvent(state, {
      type: "evidence_resolved",
      metadata: { name: "founder interviews", resolution: "Interview notes attached" },
    });
    expect(state.status).toBe("active");
    expect(getMilestoneView(state).evidenceGaps).toEqual([]);

    state = recordMilestoneEvent(state, {
      type: "scope_change",
      metadata: { requested: "Include billing", approved: false, impact: "Expands milestone" },
    });
    expect(state.status).toBe("blocked");
    expect(state.milestones[0]?.scopeChanges).toEqual([
      { requested: "Include billing", approved: false, impact: "Expands milestone" },
    ]);
  });

  test("supports skip and appending a new milestone after acceptance", () => {
    let skipped = advanceToPlanApproval(createMilestoneState(input, NOW));
    skipped = recordMilestoneEvent(skipped, {
      type: "plan_decision",
      metadata: { decision: "skip", approvedBy: "human" },
    });
    skipped = advanceMilestoneState(skipped, NOW);
    expect(skipped.milestones.map((item: { status: string }) => item.status)).toEqual([
      "skipped",
      "active",
    ]);

    const single = { ...input, milestones: [input.milestones[0]] };
    let expanded = advanceToAcceptance(createMilestoneState(single, NOW));
    expanded = recordMilestoneEvent(expanded, {
      type: "acceptance_decision",
      metadata: {
        decision: "new_milestone",
        approvedBy: "human",
        newMilestone: {
          id: "tutorial",
          title: "Add tutorial",
          outcome: "A founder can request more guidance",
          accountableRole: "product-manager",
          dependencies: ["copy"],
          acceptanceCriteria: ["tutorial is optional"],
        },
      },
    });
    expanded = advanceMilestoneState(expanded, NOW);
    expect(expanded).toMatchObject({
      status: "active",
      currentMilestoneIndex: 1,
      milestones: [{ status: "accepted" }, { id: "tutorial", status: "active" }],
    });
  });

  test("requires fresh implementation after rework and retains verification evidence", () => {
    const single = { ...input, milestones: [input.milestones[0]] };
    let state = advanceToPlanApproval(createMilestoneState(single, NOW));
    state = recordMilestoneEvent(state, {
      type: "plan_decision",
      metadata: { decision: "approve", approvedBy: "human" },
    });
    state = advanceMilestoneState(state, NOW);
    state = recordMilestoneEvent(state, {
      type: "implementation_result",
      metadata: implementationResult,
    });
    state = advanceMilestoneState(state, NOW);
    state = recordMilestoneEvent(state, {
      type: "verification_result",
      metadata: { result: "fail", evidence: ["broken"], residualRisk: ["copy unclear"] },
    });
    state = advanceMilestoneState(state, NOW);
    expect(state.milestones[0]).toMatchObject({
      stage: "rework",
      verificationResult: { result: "fail" },
    });
    expect(() => advanceMilestoneState(state, NOW)).toThrow(
      "A new implementation result is required",
    );

    state = recordMilestoneEvent(state, {
      type: "implementation_result",
      metadata: { ...implementationResult, summary: "Reworked copy" },
    });
    state = advanceMilestoneState(state, NOW);
    state = recordMilestoneEvent(state, {
      type: "verification_result",
      metadata: { result: "pass", evidence: ["replay passed"], residualRisk: [] },
    });
    state = advanceMilestoneState(state, NOW);
    expect(state.milestones[0]?.verificationResult).toMatchObject({ result: "pass" });

    state = recordMilestoneEvent(state, { type: "outcome_replay", metadata: outcomeReplay });
    state = advanceMilestoneState(state, NOW);
    state = recordMilestoneEvent(state, {
      type: "acceptance_decision",
      metadata: { decision: "rework", approvedBy: "human" },
    });
    state = advanceMilestoneState(state, NOW);
    expect(state.milestones[0]).toMatchObject({
      stage: "rework",
      outcomeReplay: null,
      acceptanceDecision: null,
    });
    expect(() => advanceMilestoneState(state, NOW)).toThrow(
      "A new implementation result is required",
    );
  });

  test("replaces a repaired role output so resolved evidence can proceed", () => {
    let state = createMilestoneState(input, NOW);
    state = recordMilestoneEvent(state, { type: "input_packet", metadata: inputPacket });
    state = advanceMilestoneState(state, NOW);
    state = recordMilestoneEvent(state, {
      type: "role_output",
      metadata: {
        ...roleOutput,
        evidence: [
          {
            claim: "Users understand the copy",
            classification: "assumed",
            risk: "high",
            consequence: "Onboarding remains unclear",
            validationAction: "Replay onboarding",
          },
        ],
      },
    });
    state = recordMilestoneEvent(state, {
      type: "repair_request",
      metadata: { reason: "Verify the high-risk claim" },
    });
    state = recordMilestoneEvent(state, {
      type: "evidence_gap",
      metadata: { name: "onboarding replay", critical: true, reason: "Replay unavailable" },
    });
    state = recordMilestoneEvent(state, {
      type: "evidence_resolved",
      metadata: { name: "onboarding replay", resolution: "Replay attached" },
    });
    state = recordMilestoneEvent(state, { type: "role_output", metadata: roleOutput });

    expect(state.milestones[0]?.roleOutputs).toHaveLength(1);
    expect(() => advanceMilestoneState(state, NOW)).not.toThrow();
  });

  test("projects available decisions and complete evidence summaries", () => {
    let state = advanceToPlanApproval(createMilestoneState(input, NOW));
    expect(getMilestoneView(state).availableDecisions).toEqual([
      "approve",
      "revise",
      "research",
      "skip",
      "stop",
    ]);

    state = recordMilestoneEvent(state, {
      type: "plan_decision",
      metadata: { decision: "approve", approvedBy: "human" },
    });
    state = advanceMilestoneState(state, NOW);
    state = recordMilestoneEvent(state, {
      type: "implementation_result",
      metadata: implementationResult,
    });
    state = advanceMilestoneState(state, NOW);
    state = recordMilestoneEvent(state, {
      type: "verification_result",
      metadata: { result: "pass", evidence: ["pass"], residualRisk: [] },
    });
    state = advanceMilestoneState(state, NOW);
    state = recordMilestoneEvent(state, { type: "outcome_replay", metadata: outcomeReplay });
    state = advanceMilestoneState(state, NOW);
    expect(getMilestoneView(state).availableDecisions).toEqual([
      "accept",
      "rework",
      "new_milestone",
      "rollback",
      "stop",
    ]);

    const summary = buildMilestoneSummary(state);
    for (const heading of [
      "# Goal Tunnel",
      "## Milestones",
      "## Evidence Gaps",
      "## Verification",
      "## User Outcome Replay",
      "### Approved Requirements",
      "### New Wishes",
    ]) {
      expect(summary).toContain(heading);
    }
    expect(summary).toContain("Complete first action: met");
  });

  test("validates outcome replay packets with Zod", () => {
    let state = advanceToAcceptance(
      createMilestoneState({ ...input, milestones: [input.milestones[0]] }, NOW),
    );
    state = {
      ...state,
      milestones: state.milestones.map((item) => ({
        ...item,
        stage: "evaluating",
        outcomeReplay: null,
      })),
    };
    expect(() =>
      recordMilestoneEvent(state, {
        type: "outcome_replay",
        metadata: { ...outcomeReplay, expectations: [{ original: "Missing fields" }] },
      }),
    ).toThrow();
  });
});
