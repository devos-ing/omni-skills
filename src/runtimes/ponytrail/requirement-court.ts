import type { GoalContract } from "./goal";
import type { Manifest } from "./manifest";
import { type ReviewVote, tallyVotes, type VoteVerdict } from "./voting";

export interface RequirementDiscussionEntry {
  botId: string;
  displayName: string;
  role: string;
  round: number;
  message: string;
  visibleThinking: RequirementPonyVisibleThinking;
  line: string;
  vote: ReviewVote["vote"];
  confidence: number;
  evidence: string[];
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

export interface RequirementCourtRound {
  round: number;
  discussion: RequirementDiscussionEntry[];
  votes: ReviewVote[];
  verdict: VoteVerdict;
}

export interface RequirementCourtResult {
  rawRequest: string;
  clarifiedRequest: string;
  draft: GoalContract;
  rounds: RequirementCourtRound[];
  discussion: RequirementDiscussionEntry[];
  votes: ReviewVote[];
  verdict: VoteVerdict;
  judge: RequirementJudgeResult;
  detailedRequirement: DetailedRequirement;
  humanConfirmation: "pending";
}

export interface RunRequirementCourtInput {
  manifest: Manifest;
  ponyRunner: RequirementPonyRunner;
}

export interface RequirementPonyRunInput {
  manifest: Manifest;
  bot: Manifest["bots"][number];
  model: Manifest["models"][number];
  contract: GoalContract;
  round: number;
  priorDiscussion: readonly RequirementDiscussionEntry[];
}

export interface RequirementPonyResponse {
  message: string;
  visibleThinking?: RequirementPonyVisibleThinking;
  evidence?: string[];
  vote: ReviewVote["vote"];
  confidence: number;
  requiredChanges: string[];
}

export interface RequirementPonyVisibleThinking {
  focus: string;
  concern: string;
  recommendation: string;
}

export type RequirementPonyRunner = (
  input: RequirementPonyRunInput,
) => RequirementPonyResponse | Promise<RequirementPonyResponse>;

const ROLE_LABELS: Record<string, string> = {
  product_manager_bot: "product",
  project_manager_bot: "project",
  engineer_bot: "engineering",
  senior_engineer_bot: "senior engineering",
  testing_bot: "testing",
};

export async function runRequirementCourt(
  contract: GoalContract,
  input: RunRequirementCourtInput,
): Promise<RequirementCourtResult> {
  const ponyRunner = input.ponyRunner;
  if (!ponyRunner) {
    throw new Error("Requirement court requires an explicit pony runner.");
  }

  const discussion: RequirementDiscussionEntry[] = [];
  const rounds: RequirementCourtRound[] = [];

  for (let round = 1; round <= input.manifest.deliberation.maxRounds; round += 1) {
    const priorDiscussion = [...discussion];
    const roundDiscussion = await Promise.all(
      input.manifest.deliberation.decisionRule.voterIds.map(async (botId) => {
        const bot = findRequirementCourtBot(botId, input.manifest);
        const model = findRequirementCourtModel(bot, input.manifest);
        const response = await ponyRunner({
          manifest: input.manifest,
          bot,
          model,
          contract,
          round,
          priorDiscussion,
        });

        return createDiscussionEntry(bot, response, round);
      }),
    );
    const votes = roundDiscussion.map(toVote);
    const verdict = tallyVotes(votes, input.manifest.deliberation.decisionRule);

    discussion.push(...roundDiscussion);
    rounds.push({
      round,
      discussion: roundDiscussion,
      votes,
      verdict,
    });

    if (verdict.approved) {
      break;
    }
  }

  const finalRound = rounds.at(-1);
  if (!finalRound) {
    throw new Error("Requirement court did not run any voting rounds.");
  }

  const judge = createJudgeResult(
    finalRound.verdict,
    input.manifest.deliberation.decisionRule.voters,
  );

  return {
    rawRequest: contract.rawRequest,
    clarifiedRequest: contract.intent,
    draft: contract,
    rounds,
    discussion,
    votes: finalRound.votes,
    verdict: finalRound.verdict,
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
  bot: Manifest["bots"][number],
  response: RequirementPonyResponse,
  round: number,
): RequirementDiscussionEntry {
  const message = response.message.trim();
  if (!message) {
    throw new Error(`Requirement pony ${bot.id} returned an empty discussion message.`);
  }
  if (response.confidence < 0 || response.confidence > 1) {
    throw new Error(`Requirement pony ${bot.id} returned confidence outside 0..1.`);
  }

  const visibleThinking = response.visibleThinking ?? createDefaultVisibleThinking(bot, message);

  return {
    botId: bot.id,
    displayName: bot.displayName,
    role: ROLE_LABELS[bot.id] ?? createRoleLabel(bot),
    round,
    message,
    visibleThinking,
    line: `${bot.id}: ${message}`,
    vote: response.vote,
    confidence: response.confidence,
    evidence: response.evidence ?? [],
    requiredChanges: response.requiredChanges,
  };
}

function createDefaultVisibleThinking(
  bot: Manifest["bots"][number],
  message: string,
): RequirementPonyVisibleThinking {
  return {
    focus: bot.instruction,
    concern: formatVisibleThinkingList(
      bot.rejectOrAmendConditions ?? [
        `No blocking ${createRoleLabel(bot)} concern was raised for this round.`,
      ],
    ),
    recommendation: message,
  };
}

function createRoleLabel(bot: Manifest["bots"][number]): string {
  return bot.displayName.replace(/\s+Bot$/u, "").toLowerCase();
}

function formatVisibleThinkingList(values: string[]): string {
  return values.join(" ");
}

function findRequirementCourtBot(botId: string, manifest: Manifest): Manifest["bots"][number] {
  const bot = manifest.bots.find((candidate) => candidate.id === botId);
  if (!bot) {
    throw new Error(`Missing requirement court bot ${botId}`);
  }

  return bot;
}

function findRequirementCourtModel(
  bot: Manifest["bots"][number],
  manifest: Manifest,
): Manifest["models"][number] {
  const model = manifest.models.find((candidate) => candidate.id === bot.model);
  if (!model) {
    throw new Error(`Requirement court bot ${bot.id} references missing model ${bot.model}`);
  }

  return model;
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
