import { describe, expect, test } from "bun:test";
import {
  brainstormRequirements,
  prepareGoalDiscussion,
} from "../src/runtimes/ponytrail/brainstorm";
import { createDefaultManifest } from "../src/runtimes/ponytrail/manifest";

describe("goal brainstorm stage", () => {
  test("asks for user details when requirements are too vague", () => {
    const result = brainstormRequirements("make it better");

    expect(result.status).toBe("needs_clarification");
    expect(result.questions).toEqual([
      "What specific outcome should the worker agent produce?",
      "Which files, product area, or workflow should be in scope?",
      "What evidence would prove the work is complete?",
    ]);
  });

  test("lets clear requirements continue into discussion", () => {
    const result = brainstormRequirements(
      "Add CSV import to the admin dashboard with row validation errors",
    );

    expect(result).toEqual({
      status: "ready_for_discussion",
      normalizedRequest: "Add CSV import to the admin dashboard with row validation errors",
      questions: [],
    });
  });

  test("blocks goal discussion until unclear requirements are answered", () => {
    const result = prepareGoalDiscussion("improve this", {
      manifest: createDefaultManifest(),
    });

    expect(result.status).toBe("needs_clarification");
    expect(result.contract).toBeNull();
    expect(result.brainstorm.questions.length).toBeGreaterThan(0);
  });

  test("prepares a goal contract only after brainstorm is clear enough", () => {
    const result = prepareGoalDiscussion("Add CSV import to admin dashboard with validation", {
      manifest: createDefaultManifest(),
    });

    expect(result.status).toBe("ready_for_discussion");
    expect(result.contract?.title).toBe("Add CSV import to admin dashboard with validation");
    expect(result.contract?.evidenceRequired).toContain("requirements_brainstorm");
  });
});
