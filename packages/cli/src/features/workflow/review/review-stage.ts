import { type AgentAdapter, runAdapterAgent } from "adapters";
import {
	buildGithubCommentPrompt,
	buildReviewPrompt,
} from "../../../skills/prompts";
import {
	buildImplementationFeedbackComment,
	buildReviewComment,
} from "../../../utils/comments";
import type { ResolvedProjectConfig, RunState } from "../../types";
import { resolveAgentLogMetadata } from "../agents/agent-log-metadata";
import { emitActionProgress, emitStageProgress } from "../progress";
import type {
	HandleReviewTestingStageDeps,
	ReviewTaskClient,
} from "../types/review-stage.types";
import { parseReviewOutcome } from "./review";
import {
	MAX_AUTOMATED_REVIEW_FIX_PASSES,
	incrementAutomatedReviewFixPasses,
	normalizeFailedReviewBugs,
	readyPullRequestAfterPassingReview,
	resolveReviewFailureStage,
	reviewFailureHumanReason,
} from "./review-stage-helpers";
export async function handleReviewTestingStage(
	config: ResolvedProjectConfig,
	agent: AgentAdapter,
	taskClient: ReviewTaskClient,
	state: RunState,
	deps: HandleReviewTestingStageDeps,
): Promise<void> {
	deps.loggerInfo(
		deps.buildIssueJobLogFields(state, "in_review"),
		"Testing issue",
	);
	emitStageProgress(state, "in_review", "started", "Testing issue");
	emitActionProgress(state, "in_review", "review-testing", "started");
	await taskClient.markStage(state.issue.id, "in_review");
	await taskClient.applyStageLabel(state.issue.id, "in_review");
	Object.assign(state, deps.transitionStage(state, "in_review"));
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
		...resolveAgentLogMetadata(config, "review-testing"),
		skillPath: config.skills.reviewTest,
		prompt,
		invoke: ({ onStream } = { onStream: () => {} }) =>
			runAdapterAgent(agent, {
				role: "review-testing",
				prompt,
				skills: [{ name: "review-testing", path: config.skills.reviewTest }],
				onStream,
			}),
	});
	const outcome = parseReviewOutcome(review.finalMessage || review.stdout);
	const retryBugs = normalizeFailedReviewBugs(outcome);
	deps.appendCodexUsage(state, "testing", review.usage, {
		agentBackend: review.backend,
	});
	state.reviewSessionId = review.sessionId;
	state.reviewSummary = outcome.summary;
	state.testingSummary = outcome.summary;
	state.bugs = retryBugs;
	await deps.saveRunState(config.workspacePath, state);
	emitActionProgress(
		state,
		"in_review",
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
			emitActionProgress(state, "in_review", "github-comment", "started");
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
				...resolveAgentLogMetadata(config, "github-comment"),
				skillPath: config.skills.githubComment,
				prompt: githubCommentPrompt,
				invoke: ({ onStream } = { onStream: () => {} }) =>
					runAdapterAgent(agent, {
						role: "github-comment",
						prompt: githubCommentPrompt,
						skills: [
							{ name: "github-comment", path: config.skills.githubComment },
						],
						onStream,
					}),
			});
			deps.appendCodexUsage(state, "testing", githubCommentResult.usage, {
				agentBackend: githubCommentResult.backend,
			});
			await deps.saveRunState(config.workspacePath, state);
			const generated =
				githubCommentResult.finalMessage?.trim() ||
				githubCommentResult.stdout?.trim();
			if (generated) {
				githubComment = generated;
			}
			emitActionProgress(state, "in_review", "github-comment", "succeeded");
		} catch (error) {
			emitActionProgress(state, "in_review", "github-comment", "failed", {
				error: error instanceof Error ? error.message : String(error),
			});
			deps.loggerInfo(
				{
					...deps.buildIssueJobLogFields(state, "in_review"),
					error: error instanceof Error ? error.message : String(error),
				},
				"GitHub comment generation failed; using default review comment",
			);
		}
	}

	if (!config.dryRun && state.pullRequest) {
		await deps.safePrComment(config, state, githubComment);
	}
	await taskClient.comment(state.issue.id, reviewComment);

	if (!outcome.passed) {
		const implementationFeedbackComment = buildImplementationFeedbackComment({
			issueKey: state.issue.key,
			summary: outcome.summary,
			bugs: retryBugs,
		});
		if (!config.dryRun && state.pullRequest) {
			await deps.safePrComment(config, state, implementationFeedbackComment);
		}
		await taskClient.comment(state.issue.id, implementationFeedbackComment);

		const nextStage = resolveReviewFailureStage(state);
		const humanReason = reviewFailureHumanReason(state);
		Object.assign(state, deps.transitionStage(state, nextStage));
		if (nextStage === "in_progress") {
			incrementAutomatedReviewFixPasses(state);
		}
		await deps.saveRunState(config.workspacePath, state);
		if (nextStage === "in_progress") {
			await taskClient.markStage(state.issue.id, nextStage);
			await taskClient.comment(
				state.issue.id,
				`Review/testing failed. Feedback was sent back to implementation for automated fix pass ${state.automatedReviewFixPasses}/${MAX_AUTOMATED_REVIEW_FIX_PASSES}.`,
			);
		} else {
			const humanComment =
				state.codexSessionId && state.automatedReviewFixPasses
					? `${humanReason} Parked for human review and PR updates.`
					: "Review/testing failed, but no resumable implementation session is available. Parked for manual review and PR updates.";
			await taskClient.markStage(state.issue.id, "in_review");
			await taskClient.applyStageLabel(state.issue.id, "in_review");
			await taskClient.comment(state.issue.id, humanComment);
			if (!config.dryRun && state.pullRequest && state.codexSessionId) {
				await deps.safePrComment(config, state, humanComment);
			}
			if (!state.humanReviewNotifiedAt && deps.safeNotifyHumanReviewRequired) {
				await deps.safeNotifyHumanReviewRequired(state, humanReason);
				state.humanReviewNotifiedAt = new Date().toISOString();
				await deps.saveRunState(config.workspacePath, state);
			}
		}
		emitStageProgress(state, "in_review", "failed", outcome.summary);
		return;
	}

	await (
		deps.readyPullRequestAfterPassingReview ??
		readyPullRequestAfterPassingReview
	)(config, state.pullRequest, true);
	Object.assign(state, deps.transitionStage(state, "done"));
	await deps.saveRunState(config.workspacePath, state);
	await taskClient.markStage(state.issue.id, "in_review");
	await taskClient.applyStageLabel(state.issue.id, "in_review");
	await taskClient.comment(
		state.issue.id,
		"Review/testing passed. PR is ready and issue remains in review until merge.",
	);
	deps.loggerInfo(
		deps.buildIssueJobLogFields(state, "in_review"),
		"Review/testing completed",
	);
	emitStageProgress(
		state,
		"in_review",
		"succeeded",
		"Review/testing completed",
	);
}
