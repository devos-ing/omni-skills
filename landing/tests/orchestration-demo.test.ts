import { describe, expect, test } from "bun:test";
import {
  getInitialPhase,
  getLaneStatus,
  getNextPhase,
  type OrchestrationPhase,
} from "../lib/orchestration-demo";

describe("orchestration demo state", () => {
  test("walks clarify, approval, dispatch, collection, synthesis, verification, complete", () => {
    const phases: OrchestrationPhase[] = [];
    let phase = getInitialPhase(false);
    for (let index = 0; index < 10 && phase.kind !== "complete"; index += 1) {
      phases.push(phase);
      phase = getNextPhase(phase, { parallelLaneCount: 3, gatedLaneCount: 1 });
    }
    phases.push(phase);
    expect(phases.map(({ kind }) => kind)).toEqual([
      "clarify",
      "approval",
      "dispatch",
      "collecting",
      "collecting",
      "collecting",
      "collecting",
      "synthesizing",
      "verifying",
      "complete",
    ]);
  });

  test("uses the complete static state for reduced motion", () => {
    expect(getInitialPhase(true)).toEqual({ kind: "complete" });
  });

  test("reports lane state without relying on color", () => {
    expect(getLaneStatus({ kind: "dispatch" }, 0)).toBe("active");
    expect(getLaneStatus({ kind: "collecting", returnedLaneCount: 1 }, 0)).toBe("complete");
    expect(getLaneStatus({ kind: "collecting", returnedLaneCount: 1 }, 1)).toBe("active");
    expect(getLaneStatus({ kind: "complete" }, 2)).toBe("complete");
  });
});
