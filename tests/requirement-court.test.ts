import { describe, expect, test } from "bun:test";
import { draftGoalContract } from "../src/runtimes/ponytrail/goal";
import { createDefaultManifest } from "../src/runtimes/ponytrail/manifest";
import {
  type PonySubagentRunner,
  runRequirementCourt,
} from "../src/runtimes/ponytrail/requirement-court";

describe("requirement court", () => {
  test("creates visible role-bot discussion entries before the Judge summary", async () => {
    const manifest = createDefaultManifest();
    const contract = draftGoalContract("Add CSV import to admin dashboard", { manifest });

    const result = await runRequirementCourt(contract, { manifest });

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

  test("uses the manifest vote rule and does not count the Judge as a voter", async () => {
    const manifest = createDefaultManifest();
    const contract = draftGoalContract("Add CSV import to admin dashboard", { manifest });

    const result = await runRequirementCourt(contract, { manifest });

    expect(result.votes.map((vote) => vote.botId)).toEqual([
      "product_manager_bot",
      "project_manager_bot",
      "engineer_bot",
      "testing_bot",
    ]);
    expect(result.votes.some((vote) => vote.botId === "requirement_judge_bot")).toBe(false);
  });

  test("uses final-round messages from each voting pony before tallying votes", async () => {
    const manifest = createDefaultManifest();
    const contract = draftGoalContract("Add CSV import to admin dashboard", { manifest });
    const calls: string[] = [];
    const ponySubagentRunner: PonySubagentRunner = async ({ botId, contract }) => {
      calls.push(botId);

      return {
        message: `${botId} reviewed ${contract.title}`,
        vote: "approve",
        confidence: 0.9,
        requiredChanges: [],
        transcript: [`${botId} received the contract`, `${botId} returned approve`],
      };
    };

    const result = await runRequirementCourt(contract, { manifest, ponySubagentRunner });

    expect(calls).toEqual([
      "product_manager_bot",
      "project_manager_bot",
      "engineer_bot",
      "testing_bot",
      "product_manager_bot",
      "project_manager_bot",
      "engineer_bot",
      "testing_bot",
    ]);
    expect(result.discussion.map((entry) => entry.message)).toEqual([
      "product_manager_bot reviewed Add CSV import to admin dashboard",
      "project_manager_bot reviewed Add CSV import to admin dashboard",
      "engineer_bot reviewed Add CSV import to admin dashboard",
      "testing_bot reviewed Add CSV import to admin dashboard",
    ]);
    expect(result.discussion[0]?.transcript).toEqual([
      "product_manager_bot received the contract",
      "product_manager_bot returned approve",
    ]);
    expect(result.verdict.approvals).toBe(4);
  });

  test("runs each voting pony once per discussion round and votes from the final round", async () => {
    const manifest = createDefaultManifest();
    const contract = draftGoalContract("Add CSV import to admin dashboard", { manifest });
    const calls: Array<{ botId: string; round: number; priorRounds: number }> = [];
    const ponySubagentRunner: PonySubagentRunner = async ({
      botId,
      contract,
      priorRounds,
      round,
    }) => {
      calls.push({ botId, round, priorRounds: priorRounds.length });

      return {
        message: `round ${round} ${botId} reviewed ${contract.title}`,
        vote: "approve",
        confidence: round === 2 ? 0.92 : 0.72,
        requiredChanges: [],
        transcript: [`${botId} saw ${priorRounds.length} prior rounds`],
      };
    };

    const result = await runRequirementCourt(contract, { manifest, ponySubagentRunner });

    expect(result.rounds.map((round) => round.round)).toEqual([1, 2]);
    expect(calls).toEqual([
      { botId: "product_manager_bot", round: 1, priorRounds: 0 },
      { botId: "project_manager_bot", round: 1, priorRounds: 0 },
      { botId: "engineer_bot", round: 1, priorRounds: 0 },
      { botId: "testing_bot", round: 1, priorRounds: 0 },
      { botId: "product_manager_bot", round: 2, priorRounds: 1 },
      { botId: "project_manager_bot", round: 2, priorRounds: 1 },
      { botId: "engineer_bot", round: 2, priorRounds: 1 },
      { botId: "testing_bot", round: 2, priorRounds: 1 },
    ]);
    expect(result.votes.map((vote) => vote.reason)).toEqual([
      "round 2 product_manager_bot reviewed Add CSV import to admin dashboard",
      "round 2 project_manager_bot reviewed Add CSV import to admin dashboard",
      "round 2 engineer_bot reviewed Add CSV import to admin dashboard",
      "round 2 testing_bot reviewed Add CSV import to admin dashboard",
    ]);
  });
});
