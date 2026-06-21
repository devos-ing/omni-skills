import { z } from "zod";
import { type DecisionRule, VoteValueSchema } from "./manifest";

export const ReviewVoteSchema = z.object({
  botId: z.string().min(1),
  vote: VoteValueSchema,
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
  requiredChanges: z.array(z.string().min(1)),
});

export type ReviewVote = z.infer<typeof ReviewVoteSchema>;

export interface VoteVerdict {
  approved: boolean;
  approvals: number;
  amendments: number;
  rejections: number;
  requiredChanges: string[];
  missingVoters: string[];
}

export function tallyVotes(votes: ReviewVote[], decisionRule: DecisionRule): VoteVerdict {
  const seen = new Set<string>();
  const allowedVoters = new Set(decisionRule.voterIds);
  const parsedVotes = votes.map((vote) => ReviewVoteSchema.parse(vote));

  for (const vote of parsedVotes) {
    if (!allowedVoters.has(vote.botId)) {
      throw new Error(`Unknown voter ${vote.botId}`);
    }

    if (seen.has(vote.botId)) {
      throw new Error(`Duplicate vote from ${vote.botId}`);
    }

    seen.add(vote.botId);
  }

  const approvals = parsedVotes.filter((vote) => vote.vote === "approve").length;
  const amendments = parsedVotes.filter((vote) => vote.vote === "amend").length;
  const rejections = parsedVotes.filter((vote) => vote.vote === "reject").length;

  return {
    approved: approvals >= decisionRule.requiredApprovals,
    approvals,
    amendments,
    rejections,
    requiredChanges: parsedVotes.flatMap((vote) => vote.requiredChanges),
    missingVoters: decisionRule.voterIds.filter((voterId) => !seen.has(voterId)),
  };
}
