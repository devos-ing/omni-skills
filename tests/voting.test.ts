import { describe, expect, test } from "bun:test";
import { createDefaultManifest } from "../src/runtimes/ponytrail/manifest";
import { tallyVotes } from "../src/runtimes/ponytrail/voting";

describe("voting", () => {
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

  test("rejects duplicate or unknown bot votes", () => {
    const manifest = createDefaultManifest();

    expect(() =>
      tallyVotes(
        [
          {
            botId: "product_manager_bot",
            vote: "approve",
            confidence: 0.9,
            reason: "Looks right.",
            requiredChanges: [],
          },
          {
            botId: "product_manager_bot",
            vote: "reject",
            confidence: 0.9,
            reason: "Duplicate vote.",
            requiredChanges: ["Remove duplicate."],
          },
        ],
        manifest.deliberation.decisionRule,
      ),
    ).toThrow("Duplicate vote from product_manager_bot");
  });

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
});
