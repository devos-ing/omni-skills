import type { Manifest } from "./manifest";

export interface DraftGoalContractInput {
  manifest: Manifest;
}

export interface GoalContract {
  title: string;
  intent: string;
  rawRequest: string;
  scope: {
    include: string[];
    exclude: string[];
  };
  acceptanceCriteria: string[];
  evidenceRequired: string[];
  risks: string[];
  openQuestions: string[];
  approvalRule: Manifest["defaultGoalTemplate"]["approvalRule"];
  status: "draft";
}

export function draftGoalContract(rawRequest: string, input: DraftGoalContractInput): GoalContract {
  const normalizedRequest = normalizeRequest(rawRequest);

  return {
    title: normalizedRequest,
    intent: normalizedRequest,
    rawRequest,
    scope: {
      include: [],
      exclude: [],
    },
    acceptanceCriteria: [
      `Human owner confirms the detailed requirement matches this request: ${normalizedRequest}`,
      "Requirement court reaches the configured 3-of-4 approval threshold.",
      "Worker execution remains gated until the human confirms the requirement direction.",
    ],
    evidenceRequired: [
      "raw_human_request",
      "requirements_brainstorm",
      "requirement_contract_draft",
      "role_bot_discussion",
      "bot_votes",
      "judge_summary",
      "detailed_requirement",
      "human_decision",
      "locked_goal_contract",
    ],
    risks: ["Goal may need refinement before execution if scope or verification remains unclear."],
    openQuestions: [],
    approvalRule: input.manifest.defaultGoalTemplate.approvalRule,
    status: "draft",
  };
}

function normalizeRequest(rawRequest: string): string {
  const normalized = rawRequest.trim().replace(/\s+/g, " ");

  if (!normalized) {
    throw new Error("Goal request cannot be empty");
  }

  return normalized;
}
