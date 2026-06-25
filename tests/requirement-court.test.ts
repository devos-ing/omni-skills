import { describe, expect, test } from "bun:test";
import { createLocalRequirementPonyRunner } from "../src/plugins";
import { draftGoalContract } from "../src/runtimes/ponytrail/goal";
import {
  createDefaultManifest,
  createDefaultSetupReviewBots,
  createSetupManifest,
  type Manifest,
} from "../src/runtimes/ponytrail/manifest";
import {
  type RequirementPonyRunner,
  runRequirementCourt,
} from "../src/runtimes/ponytrail/requirement-court";

describe("requirement court", () => {
  test("requires callers to provide a pony runner", async () => {
    const manifest = createDefaultManifest();
    const contract = draftGoalContract("Add CSV import to admin dashboard", { manifest });

    await expect(runRequirementCourt(contract, { manifest } as never)).rejects.toThrow(
      "Requirement court requires an explicit pony runner.",
    );
  });

  test("creates visible role-bot discussion entries before the Judge summary", async () => {
    const manifest = createDefaultManifest();
    const contract = draftGoalContract("Add CSV import to admin dashboard", { manifest });

    const result = await runRequirementCourt(contract, createLocalCourtInput(manifest));

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
    expect(result.discussion[0]?.visibleThinking).toEqual({
      focus: expect.stringContaining("product"),
      concern: expect.stringContaining("product"),
      recommendation: expect.stringContaining("Skills used: Intent Alignment, Scope Control"),
    });
    expect(result.verdict.approved).toBe(true);
    expect(result.judge.botId).toBe("requirement_judge_bot");
    expect(result.judge.summary).toContain("Approvals: 4/4");
    expect(result.detailedRequirement.title).toBe("Add CSV import to admin dashboard");
  });

  test("uses the manifest vote rule and does not count the Judge as a voter", async () => {
    const manifest = createDefaultManifest();
    const contract = draftGoalContract("Add CSV import to admin dashboard", { manifest });

    const result = await runRequirementCourt(contract, createLocalCourtInput(manifest));

    expect(result.votes.map((vote) => vote.botId)).toEqual([
      "product_manager_bot",
      "project_manager_bot",
      "engineer_bot",
      "testing_bot",
    ]);
    expect(result.votes.some((vote) => vote.botId === "requirement_judge_bot")).toBe(false);
  });

  test("gives role-specific guidance for broad codebase review requests", async () => {
    const manifest = createDefaultManifest();
    const contract = draftGoalContract(
      "review the codebase, make sure it's easy to manage and maintainable.",
      { manifest },
    );

    const result = await runRequirementCourt(contract, createLocalCourtInput(manifest));
    const messages = new Map(result.discussion.map((entry) => [entry.botId, entry.message]));

    expect(messages.get("product_manager_bot")).toContain("maintainability outcome");
    expect(messages.get("project_manager_bot")).toContain("sequence the review");
    expect(messages.get("engineer_bot")).toContain("module boundaries");
    expect(messages.get("testing_bot")).toContain("coverage");
    expect([...messages.values()].every((message) => message.includes("what should change"))).toBe(
      true,
    );
  });

  test("creates discussion entries for setup-defined voter bots", async () => {
    const manifest = createSetupManifest({
      reviewBots: [
        ...createDefaultSetupReviewBots(),
        {
          id: "security_bot",
          displayName: "Security Bot",
          role: "Security",
          panel: "requirement_court",
          instruction: "Review data, permission, and security risk before voting.",
          modelId: "security_model",
          modelName: "security-review-model",
          votes: true,
        },
      ],
    });
    const contract = draftGoalContract("Add CSV import to admin dashboard", { manifest });

    const result = await runRequirementCourt(contract, createLocalCourtInput(manifest));

    expect(result.discussion.map((entry) => entry.botId)).toEqual(
      manifest.deliberation.decisionRule.voterIds,
    );
    expect(result.discussion.map((entry) => entry.line)).toEqual([
      expect.stringContaining("product_manager_bot: I think"),
      expect.stringContaining("project_manager_bot: I think"),
      expect.stringContaining("senior_engineer_bot: I think"),
      expect.stringContaining("testing_bot: I think"),
      expect.stringContaining("security_bot: I think"),
    ]);
    expect(result.judge.summary).toContain("Approvals: 5/5");
  });

  test("runs one pony runner for each manifest voter with bot and model context", async () => {
    const manifest = createSetupManifest({
      reviewBots: [
        ...createDefaultSetupReviewBots(),
        {
          id: "security_bot",
          displayName: "Security Bot",
          role: "Security",
          panel: "requirement_court",
          instruction: "Review data, permission, and security risk before voting.",
          modelId: "security_model",
          modelName: "security-review-model",
          votes: true,
        },
      ],
    });
    const contract = draftGoalContract("Add CSV import to admin dashboard", { manifest });
    const calls: Array<{
      botId: string;
      modelId: string;
      round: number;
      priorDiscussionCount: number;
    }> = [];
    const ponyRunner: RequirementPonyRunner = async ({ bot, model, round, priorDiscussion }) => {
      calls.push({
        botId: bot.id,
        modelId: model.id,
        round,
        priorDiscussionCount: priorDiscussion.length,
      });

      return {
        message: `${bot.id} approves with ${model.id}`,
        visibleThinking: {
          focus: `Evaluate as ${bot.displayName}.`,
          concern: "Make sure the role-specific risk is surfaced.",
          recommendation: "Approve the direction.",
        },
        vote: "approve",
        confidence: 0.9,
        requiredChanges: [],
      };
    };

    const result = await runRequirementCourt(contract, { manifest, ponyRunner });

    expect(calls.map((call) => call.botId)).toEqual(manifest.deliberation.decisionRule.voterIds);
    expect(calls.every((call) => call.round === 1)).toBe(true);
    expect(calls.every((call) => call.priorDiscussionCount === 0)).toBe(true);
    expect(calls.map((call) => call.modelId)).toContain("security_model");
    expect(result.discussion).toHaveLength(manifest.deliberation.decisionRule.voters);
    expect(result.discussion.at(-1)).toMatchObject({
      botId: "security_bot",
      displayName: "Security Bot",
      message: "security_bot approves with security_model",
      visibleThinking: {
        focus: "Evaluate as Security Bot.",
        concern: "Make sure the role-specific risk is surfaced.",
        recommendation: "Approve the direction.",
      },
      round: 1,
      vote: "approve",
    });
  });

  test("iterates pony runners until a later round reaches the approval rule", async () => {
    const manifest = createDefaultManifest();
    const contract = draftGoalContract("Add CSV import to admin dashboard", { manifest });
    const calls: Array<{ botId: string; round: number; priorDiscussionCount: number }> = [];
    const ponyRunner: RequirementPonyRunner = async ({ bot, round, priorDiscussion }) => {
      calls.push({ botId: bot.id, round, priorDiscussionCount: priorDiscussion.length });

      if (round === 1 && ["engineer_bot", "testing_bot"].includes(bot.id)) {
        return {
          message: `${bot.id} needs clearer evidence before approval.`,
          vote: "amend",
          confidence: 0.7,
          requiredChanges: [`Clarify evidence for ${bot.id}.`],
        };
      }

      return {
        message: `${bot.id} approves round ${round}.`,
        vote: "approve",
        confidence: 0.9,
        requiredChanges: [],
      };
    };

    const result = await runRequirementCourt(contract, { manifest, ponyRunner });

    expect(result.rounds).toHaveLength(2);
    expect(result.rounds[0]?.verdict.approved).toBe(false);
    expect(result.rounds[1]?.verdict.approved).toBe(true);
    expect(result.discussion).toHaveLength(8);
    expect(calls.filter((call) => call.round === 2)).toEqual([
      { botId: "product_manager_bot", round: 2, priorDiscussionCount: 4 },
      { botId: "project_manager_bot", round: 2, priorDiscussionCount: 4 },
      { botId: "engineer_bot", round: 2, priorDiscussionCount: 4 },
      { botId: "testing_bot", round: 2, priorDiscussionCount: 4 },
    ]);
    expect(result.votes.every((vote) => vote.vote === "approve")).toBe(true);
    expect(result.judge.summary).toContain("Approvals: 4/4");
  });
});

function createLocalCourtInput(manifest: Manifest) {
  return {
    manifest,
    ponyRunner: createLocalRequirementPonyRunner(),
  };
}
