import type { GoalContract } from "./goal";
import type { Manifest } from "./manifest";
import { type ReviewVote, tallyVotes, type VoteVerdict } from "./voting";

export interface RequirementDiscussionEntry {
  botId: string;
  displayName: string;
  role: string;
  message: string;
  line: string;
  vote: ReviewVote["vote"];
  confidence: number;
  requiredChanges: string[];
}

export interface RequirementJudgeResult {
  botId: "requirement_judge_bot";
  summary: string;
  verdict: "approved" | "not approved";
}

export interface DetailedRequirement {
  title: string;
  intent: string;
  include: string[];
  exclude: string[];
  acceptanceCriteria: string[];
  evidenceRequired: string[];
  risks: string[];
  openQuestions: string[];
}

export interface RequirementCourtResult {
  rawRequest: string;
  clarifiedRequest: string;
  draft: GoalContract;
  discussion: RequirementDiscussionEntry[];
  votes: ReviewVote[];
  verdict: VoteVerdict;
  judge: RequirementJudgeResult;
  detailedRequirement: DetailedRequirement;
  humanConfirmation: "pending";
}

export interface RunRequirementCourtInput {
  manifest: Manifest;
}

const ROLE_MESSAGES: Record<string, (contract: GoalContract) => string> = {
  product_manager_bot: (contract) =>
    `I think this requirement preserves the user's product intent: ${contract.intent}. Keep the outcome explicit and avoid expanding beyond the requested workflow.`,
  project_manager_bot: (contract) =>
    `I think this can become a manageable unit of work if the delivery boundary stays tied to: ${contract.title}. Dependencies and completion evidence should stay visible.`,
  engineer_bot: (contract) =>
    `I think the requirement is feasible if the worker keeps the technical boundary aligned to: ${contract.title}. Large architecture choices should be raised before execution.`,
  testing_bot: (contract) =>
    `I think this needs observable acceptance criteria and evidence for: ${contract.title}. Edge cases and smoke verification should be named before work starts.`,
};

const ROLE_LABELS: Record<string, string> = {
  product_manager_bot: "product",
  project_manager_bot: "project",
  engineer_bot: "engineering",
  testing_bot: "testing",
};

export function runRequirementCourt(
  contract: GoalContract,
  input: RunRequirementCourtInput,
): RequirementCourtResult {
  const discussion = input.manifest.deliberation.decisionRule.voterIds.map((botId) =>
    createDiscussionEntry(botId, contract, input.manifest),
  );
  const votes = discussion.map(toVote);
  const verdict = tallyVotes(votes, input.manifest.deliberation.decisionRule);
  const judge = createJudgeResult(verdict, input.manifest.deliberation.decisionRule.voters);

  return {
    rawRequest: contract.rawRequest,
    clarifiedRequest: contract.intent,
    draft: contract,
    discussion,
    votes,
    verdict,
    judge,
    detailedRequirement: {
      title: contract.title,
      intent: contract.intent,
      include: contract.scope.include,
      exclude: contract.scope.exclude,
      acceptanceCriteria: contract.acceptanceCriteria,
      evidenceRequired: contract.evidenceRequired,
      risks: contract.risks,
      openQuestions: contract.openQuestions,
    },
    humanConfirmation: "pending",
  };
}

function createDiscussionEntry(
  botId: string,
  contract: GoalContract,
  manifest: Manifest,
): RequirementDiscussionEntry {
  const bot = manifest.bots.find((candidate) => candidate.id === botId);
  if (!bot) {
    throw new Error(`Missing requirement court bot ${botId}`);
  }

  const messageFactory = ROLE_MESSAGES[botId];
  if (!messageFactory) {
    throw new Error(`Missing discussion message factory for ${botId}`);
  }

  const message = messageFactory(contract);

  return {
    botId,
    displayName: bot.displayName,
    role: ROLE_LABELS[botId] ?? "review",
    message,
    line: `${botId}: ${message}`,
    vote: "approve",
    confidence: 0.8,
    requiredChanges: [],
  };
}

function toVote(entry: RequirementDiscussionEntry): ReviewVote {
  return {
    botId: entry.botId,
    vote: entry.vote,
    confidence: entry.confidence,
    reason: entry.message,
    requiredChanges: entry.requiredChanges,
  };
}

function createJudgeResult(verdict: VoteVerdict, voterCount: number): RequirementJudgeResult {
  const status = verdict.approved ? "approved" : "not approved";
  const changes =
    verdict.requiredChanges.length > 0
      ? ` Required changes: ${verdict.requiredChanges.join("; ")}.`
      : "";

  return {
    botId: "requirement_judge_bot",
    summary: `Approvals: ${verdict.approvals}/${voterCount}. Verdict: ${status}.${changes}`,
    verdict: status,
  };
}
