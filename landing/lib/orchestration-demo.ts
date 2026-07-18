export type LaneStatus = "queued" | "active" | "complete";

export type OrchestrationPhase =
  | { kind: "clarify" }
  | { kind: "approval" }
  | { kind: "dispatch" }
  | { kind: "collecting"; returnedLaneCount: number }
  | { kind: "synthesizing" }
  | { kind: "verifying"; completedGateCount: number }
  | { kind: "complete" };

export interface OrchestrationShape {
  parallelLaneCount: number;
  gatedLaneCount: number;
}

export const COMPLETE_PHASE: OrchestrationPhase = { kind: "complete" };

export function getInitialPhase(reducedMotion: boolean): OrchestrationPhase {
  return reducedMotion ? COMPLETE_PHASE : { kind: "clarify" };
}

export function getNextPhase(
  phase: OrchestrationPhase,
  shape: OrchestrationShape,
): OrchestrationPhase {
  switch (phase.kind) {
    case "clarify":
      return { kind: "approval" };
    case "approval":
      return { kind: "dispatch" };
    case "dispatch":
      return { kind: "collecting", returnedLaneCount: 0 };
    case "collecting":
      return phase.returnedLaneCount < shape.parallelLaneCount
        ? { kind: "collecting", returnedLaneCount: phase.returnedLaneCount + 1 }
        : { kind: "synthesizing" };
    case "synthesizing":
      return shape.gatedLaneCount === 0
        ? COMPLETE_PHASE
        : { kind: "verifying", completedGateCount: 0 };
    case "verifying":
      return phase.completedGateCount + 1 < shape.gatedLaneCount
        ? { kind: "verifying", completedGateCount: phase.completedGateCount + 1 }
        : COMPLETE_PHASE;
    case "complete":
      return COMPLETE_PHASE;
  }
}

export function getLaneStatus(phase: OrchestrationPhase, laneIndex: number): LaneStatus {
  if (phase.kind === "dispatch") return "active";
  if (phase.kind === "collecting") {
    return laneIndex < phase.returnedLaneCount ? "complete" : "active";
  }
  if (["synthesizing", "verifying", "complete"].includes(phase.kind)) return "complete";
  return "queued";
}
