import { describe, expect, test } from "bun:test";
import { draftGoalContract } from "../src/runtimes/ponytrail/goal";
import { createDefaultManifest } from "../src/runtimes/ponytrail/manifest";

describe("goal contracts", () => {
  test("drafts a requirement-first goal contract from a raw request", () => {
    const contract = draftGoalContract("Add CSV import to the admin dashboard", {
      manifest: createDefaultManifest(),
    });

    expect(contract.title).toBe("Add CSV import to the admin dashboard");
    expect(contract.intent).toBe("Add CSV import to the admin dashboard");
    expect(contract.status).toBe("draft");
    expect(contract.approvalRule.goalDirectionPanel.requiredApprovals).toBe(3);
    expect(contract.approvalRule.goalDirectionPanel.voters).toEqual([
      "product_manager_bot",
      "project_manager_bot",
      "engineer_bot",
      "testing_bot",
    ]);
    expect(contract.acceptanceCriteria).toContain(
      "Requirement court reaches the configured 3-of-4 approval threshold.",
    );
    expect(contract.evidenceRequired).toContain("bot_votes");
    expect(contract.evidenceRequired).toContain("role_bot_discussion");
    expect(contract.evidenceRequired).toContain("judge_summary");
    expect(contract.evidenceRequired).not.toContain("bot_critiques");
  });
});
