import { describe, expect, test } from "bun:test";
import {
  advanceMilestoneState,
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
    },
  ],
  risks: [],
  unresolvedQuestions: [],
  verificationMethod: "Replay onboarding",
  nextAction: "Approve plan",
};

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
    for (const event of [
      { type: "input_packet", metadata: inputPacket },
      { type: "role_output", metadata: roleOutput },
      { type: "plan_decision", metadata: { decision: "approve", approvedBy: "human" } },
      {
        type: "implementation_result",
        metadata: {
          summary: "Changed copy",
          changedFiles: ["a.ts"],
          verificationCommands: ["bun test"],
        },
      },
      {
        type: "verification_result",
        metadata: { result: "pass", evidence: ["pass"], residualRisk: [] },
      },
      {
        type: "outcome_replay",
        metadata: {
          user: "A new founder",
          expectations: [],
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
        },
      },
      { type: "acceptance_decision", metadata: { decision: "accept", approvedBy: "human" } },
    ]) {
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
});
