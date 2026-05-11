import { logger, normalizeError } from "../utils/logger";
import type {
	ResolvedNotificationConfig,
	ResolvedProjectConfig,
	RunState,
} from "./types";
import type { WorkflowLinearClient, WorkflowRuntime } from "./workflow-runtime";
import { createWorkflowRuntime } from "./workflow-runtime";

export async function safeLinearComment(
	linear: WorkflowLinearClient,
	issueId: string,
	body: string,
): Promise<void> {
	const runLogger = logger.child({ issueId });
	try {
		await linear.comment(issueId, body);
	} catch (error) {
		runLogger.error(
			{ err: normalizeError(error) },
			"Failed to add Linear comment",
		);
	}
}

export async function safePrComment(
	config: ResolvedProjectConfig,
	state: RunState,
	body: string,
	runtime: WorkflowRuntime,
): Promise<void> {
	if (!state.pullRequest) {
		return;
	}
	const runLogger = logger.child({
		projectId: state.projectId,
		issueKey: state.issue.key,
		pr: state.pullRequest.url ?? state.pullRequest.number,
	});
	try {
		runLogger.info(
			{
				commentBody: body,
				runState: state,
			},
			"Adding GitHub PR comment",
		);
		await runtime.commentOnPr(config, state.pullRequest, body);
	} catch (error) {
		runLogger.error(
			{ err: normalizeError(error) },
			"Failed to add GitHub PR comment",
		);
	}
}

export async function safeSquashMergePullRequest(
	config: ResolvedProjectConfig,
	state: RunState,
	runtime: WorkflowRuntime,
): Promise<boolean> {
	if (!state.pullRequest) {
		return false;
	}
	const runLogger = logger.child({
		projectId: state.projectId,
		issueKey: state.issue.key,
		pr: state.pullRequest.url ?? state.pullRequest.number,
	});
	try {
		return await runtime.squashMergePullRequest(config, state.pullRequest);
	} catch (error) {
		runLogger.error(
			{ err: normalizeError(error) },
			"Failed to squash-merge GitHub PR",
		);
		return false;
	}
}

export async function safeNotifyTaskOutcome(
	notifications: ResolvedNotificationConfig,
	state: RunState,
	outcome: "done" | "blocked",
	errorMessage?: string,
	runtime: WorkflowRuntime = createWorkflowRuntime(),
): Promise<void> {
	const runLogger = logger.child({
		projectId: state.projectId,
		issueKey: state.issue.key,
		outcome,
	});
	try {
		await runtime.sendTaskOutcomeEmail(
			notifications.email,
			state,
			outcome,
			errorMessage,
		);
	} catch (error) {
		runLogger.error(
			{ err: normalizeError(error) },
			"Failed to send task outcome email notification",
		);
	}
}

export async function safeNotifyHumanReviewRequired(
	notifications: ResolvedNotificationConfig,
	state: RunState,
	complexityScore: number,
	reason: string,
	runtime: WorkflowRuntime,
): Promise<void> {
	const runLogger = logger.child({
		projectId: state.projectId,
		issueKey: state.issue.key,
		outcome: "human_review_required",
	});
	try {
		await runtime.sendHumanReviewRequiredEmail(notifications.email, state, {
			complexityScore,
			reason,
		});
	} catch (error) {
		runLogger.error(
			{ err: normalizeError(error) },
			"Failed to send human review required email notification",
		);
	}
}

export async function safeLinearMoveToCanceled(
	linear: WorkflowLinearClient,
	issueId: string,
): Promise<void> {
	const runLogger = logger.child({ issueId, stage: "canceled" });
	try {
		await linear.markCanceled(issueId);
	} catch (error) {
		runLogger.error(
			{ err: normalizeError(error) },
			"Failed to move Linear issue to Canceled",
		);
	}
}
