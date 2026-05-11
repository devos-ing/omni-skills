import { commentOnPr, squashMergePullRequest } from "../services/github";
import type { LinearClient } from "../services/linear";
import {
	sendHumanReviewRequiredEmail,
	sendTaskOutcomeEmail,
} from "../services/notifications";
import { logger, normalizeError } from "../utils/logger";
import type { IntegrationWrapperDeps } from "./integration-wrappers.types";
import type {
	ResolvedNotificationConfig,
	ResolvedProjectConfig,
	RunState,
} from "./types";

export async function safeLinearComment(
	linear: Pick<LinearClient, "comment">,
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

export async function safeLinearMoveToCanceled(
	linear: Pick<LinearClient, "markCanceled">,
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

export async function safePrComment(
	config: ResolvedProjectConfig,
	state: RunState,
	body: string,
	deps: IntegrationWrapperDeps = {},
): Promise<void> {
	if (!state.pullRequest) {
		return;
	}
	const runLogger = logger.child({
		projectId: state.projectId,
		issueKey: state.issue.key,
		pr: state.pullRequest.url ?? state.pullRequest.number,
	});
	const comment = deps.commentOnPr ?? commentOnPr;
	try {
		runLogger.info(
			{
				commentBody: body,
				runState: state,
			},
			"Adding GitHub PR comment",
		);
		await comment(config, state.pullRequest, body);
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
	deps: IntegrationWrapperDeps = {},
): Promise<boolean> {
	if (!state.pullRequest) {
		return false;
	}
	const runLogger = logger.child({
		projectId: state.projectId,
		issueKey: state.issue.key,
		pr: state.pullRequest.url ?? state.pullRequest.number,
	});
	const merge = deps.squashMergePullRequest ?? squashMergePullRequest;
	try {
		return await merge(config, state.pullRequest);
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
	deps: IntegrationWrapperDeps = {},
): Promise<void> {
	const runLogger = logger.child({
		projectId: state.projectId,
		issueKey: state.issue.key,
		outcome,
	});
	const notify = deps.sendTaskOutcomeEmail ?? sendTaskOutcomeEmail;
	try {
		await notify(notifications.email, state, outcome, errorMessage);
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
	deps: IntegrationWrapperDeps = {},
): Promise<void> {
	const runLogger = logger.child({
		projectId: state.projectId,
		issueKey: state.issue.key,
		outcome: "human_review_required",
	});
	const notify =
		deps.sendHumanReviewRequiredEmail ?? sendHumanReviewRequiredEmail;
	try {
		await notify(notifications.email, state, {
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
