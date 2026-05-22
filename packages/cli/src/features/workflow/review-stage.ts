import type { AgentAdapter } from "adapters";
import type {
	ResolvedNotificationConfig,
	ResolvedProjectConfig,
	RunState,
} from "../../features/types";
import {
	buildGithubCommentPrompt,
	buildReviewPrompt,
} from "../../skills/prompts";
import {
	buildImplementationFeedbackComment,
	buildReviewComment,
} from "../../utils/comments";
import { emitActionProgress, emitStageProgress } from "./progress";
import { parseReviewOutcome } from "./review";
import {
	MAX_AUTOMATED_REVIEW_FIX_PASSES,
	incrementAutomatedReviewFixPasses,
	normalizeFailedReviewBugs,
	readyPullRequestAfterPassingReview,
	resolveReviewFailureStage,
	reviewFailureHumanReason,
} from "./review-stage-helpers";
import type {
	FinalizeReviewMergeDeps,
	HandleReviewTestingStageDeps,
	ReviewLinearClient,
} from "./review-stage.types";
export {
	MAX_AUTOMATED_REVIEW_FIX_PASSES,
	incrementAutomatedReviewFixPasses,
	normalizeFailedReviewBugs,
	readyPullRequestAfterPassingReview,
	reviewFailureHumanReason,
	resolveReviewFailureStage,
} from "./review-stage-helpers";
export async function handleReviewTestingStage(
	config: ResolvedProjectConfig,
	agent: AgentAdapter,
	linear: ReviewLinearClient,
	state: RunState,
	deps: HandleReviewTestingStageDeps,
): Promise<void> {
	deps.loggerInfo(
		deps.buildIssueJobLogFields(state, "testing"),
		"Testing issue",
	);
	emitStageProgress(state, "testing", "started", "Testing issue");
	emitActionProgress(state, "testing", "review-testing", "started");
	await linear.markStage(state.issue.id, "testing");
	await linear.applyStageLabel(state.issue.id, "testing");
	Object.assign(state, deps.transitionStage(state, "testing"));
	await deps.saveRunState(config.workspacePath, state);

	const prompt = await buildReviewPrompt(
		config.skills.reviewTest,
		state.issue,
		state.pullRequest,
		{ planSummary: state.planSummary, successGoal: state.successGoal },
	);
	const review = await deps.runAgentWithChatLog({
		workspacePath: config.workspacePath,
		projectId: config.id,
		issue: state.issue,
		agentRole: "review-testing",
		skillPath: config.skills.reviewTest,
		prompt,
		invoke: () => agent.runReview(prompt),
	});
	const outcome = parseReviewOutcome(review.finalMessage || review.stdout);
	const retryBugs = normalizeFailedReviewBugs(outcome);
	deps.appendCodexUsage(state, "testing", review.usage);
	state.reviewSessionId = review.sessionId;
	state.reviewSummary = outcome.summary;
	state.testingSummary = outcome.summary;
	state.bugs = retryBugs;
	await deps.saveRunState(config.workspacePath, state);
	emitActionProgress(
		state,
		"testing",
		"review-testing",
		outcome.passed ? "succeeded" : "failed",
		{
			detail: outcome.summary,
			error: outcome.passed ? undefined : outcome.summary,
		},
	);

	const reviewComment = buildReviewComment({
		issueKey: state.issue.key,
		passed: outcome.passed,
		summary: outcome.summary,
		usage: review.usage,
		bugs: retryBugs,
	});

	let githubComment = reviewComment;
	if (!config.dryRun && state.pullRequest) {
		try {
			emitActionProgress(state, "testing", "github-comment", "started");
			const githubCommentPrompt = await buildGithubCommentPrompt(
				config.skills.githubComment,
				state.issue,
				state.pullRequest,
				{
					passed: outcome.passed,
					summary: outcome.summary,
					bugs: retryBugs,
				},
			);
			const githubCommentResult = await deps.runAgentWithChatLog({
				workspacePath: config.workspacePath,
				projectId: config.id,
				issue: state.issue,
				agentRole: "github-comment",
				skillPath: config.skills.githubComment,
				prompt: githubCommentPrompt,
				invoke: () => agent.runGithubComment(githubCommentPrompt),
			});
			deps.appendCodexUsage(state, "testing", githubCommentResult.usage);
			await deps.saveRunState(config.workspacePath, state);
			const generated =
				githubCommentResult.finalMessage?.trim() ||
				githubCommentResult.stdout?.trim();
			if (generated) {
				githubComment = generated;
			}
			emitActionProgress(state, "testing", "github-comment", "succeeded");
		} catch (error) {
			emitActionProgress(state, "testing", "github-comment", "failed", {
				error: error instanceof Error ? error.message : String(error),
			});
			deps.loggerInfo(
				{
					...deps.buildIssueJobLogFields(state, "testing"),
					error: error instanceof Error ? error.message : String(error),
				},
				"GitHub comment generation failed; using default review comment",
			);
		}
	}

	if (!config.dryRun && state.pullRequest) {
		await deps.safePrComment(config, state, githubComment);
	}
	await linear.comment(state.issue.id, reviewComment);

	if (!outcome.passed) {
		const implementationFeedbackComment = buildImplementationFeedbackComment({
			issueKey: state.issue.key,
			summary: outcome.summary,
			bugs: retryBugs,
		});
		if (!config.dryRun && state.pullRequest) {
			await deps.safePrComment(config, state, implementationFeedbackComment);
		}
		await linear.comment(state.issue.id, implementationFeedbackComment);

		const nextStage = resolveReviewFailureStage(state);
		const humanReason = reviewFailureHumanReason(state);
		Object.assign(state, deps.transitionStage(state, nextStage));
		if (nextStage === "implementing") {
			incrementAutomatedReviewFixPasses(state);
		}
		await deps.saveRunState(config.workspacePath, state);
		if (nextStage === "implementing") {
			await linear.markStage(state.issue.id, nextStage);
			await linear.comment(
				state.issue.id,
				`Review/testing failed. Feedback was sent back to implementation for automated fix pass ${state.automatedReviewFixPasses}/${MAX_AUTOMATED_REVIEW_FIX_PASSES}.`,
			);
		} else {
			const humanComment =
				state.codexSessionId && state.automatedReviewFixPasses
					? `${humanReason} Parked for human review and PR updates.`
					: "Review/testing failed, but no resumable implementation session is available. Parked for manual review and PR updates.";
			await linear.markStage(state.issue.id, "reviewing");
			await linear.applyStageLabel(state.issue.id, "reviewing");
			await linear.comment(state.issue.id, humanComment);
			if (!config.dryRun && state.pullRequest && state.codexSessionId) {
				await deps.safePrComment(config, state, humanComment);
			}
			if (!state.humanReviewNotifiedAt && deps.safeNotifyHumanReviewRequired) {
				await deps.safeNotifyHumanReviewRequired(state, humanReason);
				state.humanReviewNotifiedAt = new Date().toISOString();
				await deps.saveRunState(config.workspacePath, state);
			}
		}
		emitStageProgress(state, "testing", "failed", outcome.summary);
		return;
	}

	await (
		deps.readyPullRequestAfterPassingReview ??
		readyPullRequestAfterPassingReview
	)(config, state.pullRequest, true);
	Object.assign(state, deps.transitionStage(state, "done"));
	await deps.saveRunState(config.workspacePath, state);
	await linear.markStage(state.issue.id, "reviewing");
	await linear.applyStageLabel(state.issue.id, "reviewing");
	await linear.comment(
		state.issue.id,
		"Review/testing passed. PR is ready and issue remains in review until merge.",
	);
	deps.loggerInfo(
		deps.buildIssueJobLogFields(state, "testing"),
		"Review/testing completed",
	);
	emitStageProgress(state, "testing", "succeeded", "Review/testing completed");
}

export async function finalizeIssueAfterReviewMerge(
	config: ResolvedProjectConfig,
	notifications: ResolvedNotificationConfig,
	linear: ReviewLinearClient,
	state: RunState,
	deps: FinalizeReviewMergeDeps,
): Promise<void> {
	await linear.markStage(state.issue.id, "done");
	await linear.clearWorkflowStageLabels(state.issue.id);
	await linear.comment(
		state.issue.id,
		"PR squash-merged after completed review.",
	);
	state.pullRequestApprovedAt = new Date().toISOString();
	await deps.saveRunState(config.workspacePath, state);
	await deps.safeNotifyTaskOutcome(notifications, state, "done");
}
