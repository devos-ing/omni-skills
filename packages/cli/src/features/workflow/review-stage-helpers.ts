import type { ResolvedProjectConfig, RunState } from "../../features/types";
import { markPrReadyForReview } from "../../integrations/github";
import type { ReviewOutcome } from "./review";

export const MAX_AUTOMATED_REVIEW_FIX_PASSES = 3;

export function resolveReviewFailureStage(
	state: Pick<RunState, "codexSessionId" | "automatedReviewFixPasses">,
): Extract<RunState["stage"], "implementing" | "human_review"> {
	if (!state.codexSessionId) {
		return "human_review";
	}
	return (state.automatedReviewFixPasses ?? 0) >=
		MAX_AUTOMATED_REVIEW_FIX_PASSES
		? "human_review"
		: "implementing";
}

export function incrementAutomatedReviewFixPasses(state: RunState): number {
	state.automatedReviewFixPasses = (state.automatedReviewFixPasses ?? 0) + 1;
	return state.automatedReviewFixPasses;
}

export function reviewFailureHumanReason(state: RunState): string {
	if (!state.codexSessionId) {
		return "Review/testing failed, but no resumable implementation session is available.";
	}
	return `Review/testing failed after ${MAX_AUTOMATED_REVIEW_FIX_PASSES} automated fix passes.`;
}

export function normalizeFailedReviewBugs(
	outcome: ReviewOutcome,
): RunState["bugs"] {
	if (outcome.passed) {
		return [];
	}
	if (outcome.bugs.length > 0) {
		return outcome.bugs;
	}
	const summary =
		outcome.summary.trim() ||
		"Review/testing failed but no structured BUGS_JSON details were provided.";
	return [
		{
			title: "Review/testing failed without structured bug details",
			body: summary,
		},
	];
}

export async function readyPullRequestAfterPassingReview(
	config: ResolvedProjectConfig,
	pullRequest: RunState["pullRequest"],
	passed: boolean,
	deps?: {
		markPrReadyForReview?: typeof markPrReadyForReview;
	},
): Promise<boolean> {
	if (!passed || config.dryRun || !pullRequest) {
		return false;
	}
	const markReady = deps?.markPrReadyForReview ?? markPrReadyForReview;
	return markReady(config, pullRequest);
}
