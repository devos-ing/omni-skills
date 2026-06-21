import { draftGoalContract, type GoalContract } from "./goal";
import type { Manifest } from "./manifest";

export type BrainstormStatus = "needs_clarification" | "ready_for_discussion";

export interface RequirementsBrainstorm {
  status: BrainstormStatus;
  normalizedRequest: string;
  questions: string[];
}

export interface PrepareGoalDiscussionInput {
  manifest: Manifest;
}

export type PreparedGoalDiscussion =
  | {
      status: "needs_clarification";
      brainstorm: RequirementsBrainstorm;
      contract: null;
    }
  | {
      status: "ready_for_discussion";
      brainstorm: RequirementsBrainstorm;
      contract: GoalContract;
    };

const CLARIFYING_QUESTIONS = [
  "What specific outcome should the worker agent produce?",
  "Which files, product area, or workflow should be in scope?",
  "What evidence would prove the work is complete?",
];

const VAGUE_REQUEST_PATTERNS = [
  /\bmake it better\b/i,
  /\bimprove this\b/i,
  /\bfix it\b/i,
  /\bdo this\b/i,
  /\bmake changes\b/i,
  /\bupdate stuff\b/i,
];

export function brainstormRequirements(rawRequest: string): RequirementsBrainstorm {
  const normalizedRequest = normalizeRequest(rawRequest);
  const questions = isUnclearRequest(normalizedRequest) ? CLARIFYING_QUESTIONS : [];

  return {
    status: questions.length > 0 ? "needs_clarification" : "ready_for_discussion",
    normalizedRequest,
    questions,
  };
}

export function prepareGoalDiscussion(
  rawRequest: string,
  input: PrepareGoalDiscussionInput,
): PreparedGoalDiscussion {
  const brainstorm = brainstormRequirements(rawRequest);

  if (brainstorm.status === "needs_clarification") {
    return {
      status: "needs_clarification",
      brainstorm,
      contract: null,
    };
  }

  return {
    status: "ready_for_discussion",
    brainstorm,
    contract: draftGoalContract(brainstorm.normalizedRequest, input),
  };
}

function isUnclearRequest(normalizedRequest: string): boolean {
  const words = normalizedRequest.split(" ").filter(Boolean);

  if (words.length < 5) {
    return true;
  }

  return VAGUE_REQUEST_PATTERNS.some((pattern) => pattern.test(normalizedRequest));
}

function normalizeRequest(rawRequest: string): string {
  const normalized = rawRequest.trim().replace(/\s+/g, " ");

  if (!normalized) {
    throw new Error("Requirement request cannot be empty");
  }

  return normalized;
}
