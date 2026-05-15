import type {
	ResolvedNotificationConfig,
	ResolvedProjectConfig,
	RunState,
	WorkflowStage,
} from "../../features/types";
import { shouldSquashMergePullRequestForComplexityScore } from "./plan";
import { matchesIssueStateConfigValue } from "./workflow-linear-state";
import type { WorkflowLinearClient, WorkflowRuntime } from "./workflow-runtime";
import type { WorkflowIssue } from "./workflow.types";

const DEFAULT_PLANNER_COMPLEXITY_SCORE = 4;
const HUMAN_REVIEW_COMPLEXITY_THRESHOLD = 5;

export function resolveReviewOnlyBootstrapStage(
	state: WorkflowIssue["state"],
	statusMap: ResolvedProjectConfig["linear"]["statusMap"],
): WorkflowStage {
	if (matchesIssueStateConfigValue(state, statusMap.pr_created)) {
		return "pr_created";
	}
	if (matchesIssueStateConfigValue(state, statusMap.reviewing)) {
		return "reviewing";
	}
	if (matchesIssueStateConfigValue(state, statusMap.done)) {
		return "done";
	}
	return "testing";
}

export async function handleReceivedStage(
	config: ResolvedProjectConfig,
	linear: WorkflowLinearClient,
	state: RunState,
	deps: {
		transitionStage: (state: RunState, to: WorkflowStage) => RunState;
		saveRunState: (workspacePath: string, state: RunState) => Promise<void>;
	},
): Promise<void> {
	await linear.markStage(state.issue.id, "planning");
	await linear.comment(state.issue.id, "devos.ing started planning.");
	Object.assign(state, deps.transitionStage(state, "planning"));
	await deps.saveRunState(config.workspacePath, state);
}

export async function handlePrCreatedStage(
	config: ResolvedProjectConfig,
	linear: WorkflowLinearClient,
	state: RunState,
	deps: {
		transitionStage: (state: RunState, to: WorkflowStage) => RunState;
		saveRunState: (workspacePath: string, state: RunState) => Promise<void>;
	},
): Promise<void> {
	Object.assign(state, deps.transitionStage(state, "reviewing"));
	await deps.saveRunState(config.workspacePath, state);
	await linear.markStage(state.issue.id, "reviewing");
	await linear.applyStageLabel(state.issue.id, "reviewing");
}

export async function handleDoneReviewMergeStage(
	config: ResolvedProjectConfig,
	notifications: ResolvedNotificationConfig,
	linear: WorkflowLinearClient,
	state: RunState,
	runtime: WorkflowRuntime,
	deps: {
		saveRunState: (workspacePath: string, state: RunState) => Promise<void>;
		safeNotifyHumanReviewRequired: (
			notifications: ResolvedNotificationConfig,
			state: RunState,
			complexityScore: number,
			reason: string,
			runtime: WorkflowRuntime,
		) => Promise<void>;
		safeSquashMergePullRequest: (
			config: ResolvedProjectConfig,
			state: RunState,
			runtime: WorkflowRuntime,
		) => Promise<boolean>;
		finalizeIssueAfterReviewMerge: (
			config: ResolvedProjectConfig,
			notifications: ResolvedNotificationConfig,
			linear: WorkflowLinearClient,
			state: RunState,
			runtime: WorkflowRuntime,
		) => Promise<void>;
	},
): Promise<void> {
	if (state.pullRequestApprovedAt) {
		return;
	}

	const score = state.complexityScore ?? DEFAULT_PLANNER_COMPLEXITY_SCORE;
	if (!shouldSquashMergePullRequestForComplexityScore(score)) {
		const reason = `Planning complexity score ${score}/10 requires human PR approval (threshold >= ${HUMAN_REVIEW_COMPLEXITY_THRESHOLD}).`;
		if (!state.humanReviewNotifiedAt) {
			await linear.comment(
				state.issue.id,
				[
					`Human PR approval required for ${state.issue.key}.`,
					reason,
					state.pullRequest?.url ? `PR: ${state.pullRequest.url}` : undefined,
				]
					.filter(Boolean)
					.join("\n"),
			);
			await deps.safeNotifyHumanReviewRequired(
				notifications,
				state,
				score,
				reason,
				runtime,
			);
			state.humanReviewNotifiedAt = new Date().toISOString();
			await deps.saveRunState(config.workspacePath, state);
		}
		return;
	}

	const merged = await deps.safeSquashMergePullRequest(config, state, runtime);
	if (!merged) {
		return;
	}

	await deps.finalizeIssueAfterReviewMerge(
		config,
		notifications,
		linear,
		state,
		runtime,
	);
}
