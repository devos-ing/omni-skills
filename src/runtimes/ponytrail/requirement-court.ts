import type { GoalContract } from "./goal";
import type { Manifest } from "./manifest";
import { type ReviewVote, tallyVotes, type VoteVerdict } from "./voting";

export interface RequirementDiscussionEntry {
  botId: string;
  displayName: string;
  role: string;
  round: number;
  message: string;
  line: string;
  vote: ReviewVote["vote"];
  confidence: number;
  requiredChanges: string[];
  transcript: string[];
}

export interface RequirementDiscussionRound {
  round: number;
  discussion: RequirementDiscussionEntry[];
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
  rounds: RequirementDiscussionRound[];
  discussion: RequirementDiscussionEntry[];
  votes: ReviewVote[];
  verdict: VoteVerdict;
  judge: RequirementJudgeResult;
  detailedRequirement: DetailedRequirement;
  humanConfirmation: "pending";
}

export interface RunRequirementCourtInput {
  manifest: Manifest;
  ponySubagentRunner?: PonySubagentRunner | undefined;
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

type RequirementCourtBot = Manifest["bots"][number];

export interface PonySubagentRunInput {
  botId: string;
  displayName: string;
  role: string;
  model: string;
  instruction: string;
  skills: string[];
  approvalConditions: string[];
  rejectOrAmendConditions: string[];
  contract: GoalContract;
  round: number;
  priorRounds: RequirementDiscussionRound[];
}

export interface PonySubagentRunResult {
  message: string;
  vote: ReviewVote["vote"];
  confidence: number;
  requiredChanges: string[];
  transcript?: string[] | undefined;
}

export type PonySubagentRunner = (
  input: PonySubagentRunInput,
) => PonySubagentRunResult | Promise<PonySubagentRunResult>;

export async function runRequirementCourt(
  contract: GoalContract,
  input: RunRequirementCourtInput,
): Promise<RequirementCourtResult> {
  const runner = input.ponySubagentRunner ?? runDefaultPonySubagent;
  const rounds: RequirementDiscussionRound[] = [];
  const maxRounds = Math.max(1, input.manifest.deliberation.maxRounds);

  for (let round = 1; round <= maxRounds; round++) {
    const priorRounds = rounds.slice();
    const discussion = await Promise.all(
      input.manifest.deliberation.decisionRule.voterIds.map((botId) =>
        createDiscussionEntry(botId, contract, input.manifest, runner, round, priorRounds),
      ),
    );

    rounds.push({ round, discussion });
  }

  const discussion = rounds.at(-1)?.discussion ?? [];
  const votes = discussion.map(toVote);
  const verdict = tallyVotes(votes, input.manifest.deliberation.decisionRule);
  const judge = createJudgeResult(verdict, input.manifest.deliberation.decisionRule.voters);

  return {
    rawRequest: contract.rawRequest,
    clarifiedRequest: contract.intent,
    draft: contract,
    rounds,
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

async function createDiscussionEntry(
  botId: string,
  contract: GoalContract,
  manifest: Manifest,
  runner: PonySubagentRunner,
  round: number,
  priorRounds: RequirementDiscussionRound[],
): Promise<RequirementDiscussionEntry> {
  const bot = manifest.bots.find((candidate) => candidate.id === botId);
  if (!bot) {
    throw new Error(`Missing requirement court bot ${botId}`);
  }

  const role = ROLE_LABELS[botId] ?? "review";

  const result = await runner({
    botId,
    displayName: bot.displayName,
    role,
    model: bot.model,
    instruction: bot.instruction,
    skills: bot.skills,
    approvalConditions: bot.approvalConditions ?? [],
    rejectOrAmendConditions: bot.rejectOrAmendConditions ?? [],
    contract,
    round,
    priorRounds,
  });
  const normalized = normalizePonySubagentResult(bot, result);

  return {
    botId,
    displayName: bot.displayName,
    role,
    round,
    message: normalized.message,
    line: `${botId}: ${normalized.message}`,
    vote: normalized.vote,
    confidence: normalized.confidence,
    requiredChanges: normalized.requiredChanges,
    transcript: normalized.transcript ?? [],
  };
}

function runDefaultPonySubagent(input: PonySubagentRunInput): PonySubagentRunResult {
  const messageFactory = ROLE_MESSAGES[input.botId];
  if (!messageFactory) {
    throw new Error(`Missing discussion message factory for ${input.botId}`);
  }

  const message = messageFactory(input.contract);

  return {
    message,
    vote: "approve",
    confidence: 0.8,
    requiredChanges: [],
    transcript: [
      `${input.displayName} reviewed the draft requirement as the ${input.role} pony.`,
      `${input.displayName} voted approve with confidence 0.8.`,
    ],
  };
}

function normalizePonySubagentResult(
  bot: RequirementCourtBot,
  result: PonySubagentRunResult,
): PonySubagentRunResult {
  if (!result.message.trim()) {
    throw new Error(`Pony subagent ${bot.id} returned an empty discussion message`);
  }

  if (result.confidence < 0 || result.confidence > 1) {
    throw new Error(`Pony subagent ${bot.id} returned confidence outside 0..1`);
  }

  return {
    message: result.message.trim(),
    vote: result.vote,
    confidence: result.confidence,
    requiredChanges: result.requiredChanges,
    transcript: result.transcript?.map((line) => line.trim()).filter(Boolean),
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
