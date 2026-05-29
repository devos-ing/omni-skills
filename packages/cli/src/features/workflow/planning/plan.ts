import { type AgentAdapter, runAdapterAgent } from "adapters";
import { selectPlanningSupplementalSkills } from "../../../skills/catalog";
import { buildPlanPrompt } from "../../../skills/prompts";
import {
	buildPlanComment,
	buildPlanNeedsInfoComment,
	buildPlanSplitComment,
} from "../../../utils/comments";
import type {
	ResolvedNotificationConfig,
	ResolvedProjectConfig,
	RunState,
} from "../../types";
import { resolveAgentLogMetadata } from "../agents/agent-log-metadata";
import {
	emitActionProgress,
	emitPlanningSummaryProgress,
	emitStageProgress,
} from "../progress";
import { loadRunState } from "../state";
import type {
	HandlePlanningStageDeps,
	PlannerDecision,
	PlanningTaskClient,
} from "../types/plan.types";
import { parsePlannerDecision } from "./plan-parsing";
import { buildPlannerRepairPrompt } from "./plan-repair-prompt";

const HUMAN_REVIEW_COMPLEXITY_THRESHOLD = 5;
export async function handlePlanningStage(
	config: ResolvedProjectConfig,
	agent: AgentAdapter,
	notifications: ResolvedNotificationConfig,
	taskClient: PlanningTaskClient,
	state: RunState,
	deps: HandlePlanningStageDeps,
): Promise<void> {
	deps.loggerInfo(deps.buildIssueJobLogFields(state, "plan"), "Planning issue");
	emitStageProgress(state, "plan", "started", "Planning issue");
	emitActionProgress(state, "plan", "plan", "started");
	const supplemental = await selectPlanningSupplementalSkills(
		config,
		state.issue,
	);
	const prompt = await buildPlanPrompt(config.skills.plan, state.issue, {
		supplementalSkills: supplemental.selected,
		autoSelectWarnings: supplemental.warnings,
	});
	const parentSessionId = await resolveParentPlanningSessionId(
		config.workspacePath,
		config.id,
		state,
	);
	let result = await deps.runAgentWithChatLog({
		workspacePath: config.workspacePath,
		projectId: config.id,
		issue: state.issue,
		agentRole: "planning",
		...resolveAgentLogMetadata(config, "planning"),
		skillPath: config.skills.plan,
		prompt,
		invoke: ({ onStream } = { onStream: () => {} }) =>
			runAdapterAgent(agent, {
				role: "planning",
				prompt,
				sessionId: parentSessionId,
				skills: [{ name: "planning", path: config.skills.plan }],
				onStream,
			}),
	});
	state.codexSessionId = result.sessionId ?? state.codexSessionId;
	state.planSummary = result.finalMessage || result.stdout;
	deps.appendCodexUsage(state, "planning", result.usage, {
		agentBackend: result.backend,
	});

	let parsedPlan: PlannerDecision;
	try {
		parsedPlan = parsePlannerDecision(state.planSummary);
	} catch (error) {
		if (!shouldRetryMalformedPlannerOutput(state.planSummary)) {
			throw error;
		}
		const repairPrompt = buildPlannerRepairPrompt(prompt, state.planSummary);
		const resumeSessionId = result.sessionId ?? parentSessionId;
		result = await deps.runAgentWithChatLog({
			workspacePath: config.workspacePath,
			projectId: config.id,
			issue: state.issue,
			agentRole: "planning",
			...resolveAgentLogMetadata(config, "planning"),
			skillPath: config.skills.plan,
			prompt: repairPrompt,
			invoke: ({ onStream } = { onStream: () => {} }) =>
				runAdapterAgent(agent, {
					role: "planning",
					prompt: repairPrompt,
					sessionId: resumeSessionId,
					skills: [{ name: "planning", path: config.skills.plan }],
					onStream,
				}),
		});
		state.codexSessionId = result.sessionId ?? state.codexSessionId;
		state.planSummary = result.finalMessage || result.stdout;
		deps.appendCodexUsage(state, "planning", result.usage, {
			agentBackend: result.backend,
		});
		try {
			parsedPlan = parsePlannerDecision(state.planSummary);
		} catch (retryError) {
			if (!shouldRetryMalformedPlannerOutput(state.planSummary)) {
				throw retryError;
			}
			parsedPlan = {
				result: "NEEDS_INFO",
				questions: [
					"What outcome should this task accomplish, and how should review/testing verify it?",
				],
			};
		}
	}
	if (parsedPlan.result === "NEEDS_INFO") {
		state.successGoal = undefined;
		state.complexityScore = undefined;
		state.reviewMode = undefined;
		state.planningNeedsInfoQuestions = parsedPlan.questions;
		state.failedStage = "plan";
		state.lastError = "Planning needs clarification before implementation.";
		Object.assign(state, deps.transitionStage(state, "canceled"));
		await deps.saveRunState(config.workspacePath, state);
		await taskClient.markStage(state.issue.id, "canceled");
		await taskClient.clearWorkflowStageLabels(state.issue.id);
		await taskClient.comment(
			state.issue.id,
			buildPlanNeedsInfoComment({
				issueKey: state.issue.key,
				questions: parsedPlan.questions,
				usage: result.usage,
			}),
		);
		await deps.safeNotifyTaskOutcome(
			notifications,
			state,
			"canceled",
			state.lastError,
		);
		emitActionProgress(state, "plan", "plan", "canceled", {
			detail: state.lastError,
		});
		emitStageProgress(state, "plan", "canceled", state.lastError);
		deps.loggerInfo(
			deps.buildIssueJobLogFields(state, "plan"),
			"Plan needs clarification",
		);
		return;
	}
	state.successGoal = parsedPlan.successGoal;
	state.planningNeedsInfoQuestions = undefined;
	state.complexityScore = parsedPlan.complexityScore;
	state.reviewMode = resolveReviewModeForComplexityScore(
		parsedPlan.complexityScore,
	);
	if (parsedPlan.complexity === "SIMPLE") {
		Object.assign(state, deps.transitionStage(state, "in_progress"));
		await deps.saveRunState(config.workspacePath, state);
		await taskClient.markStage(state.issue.id, "in_progress");
		await taskClient.comment(
			state.issue.id,
			buildPlanComment(state.issue.key, state.planSummary, result.usage),
		);
		emitPlanningSummaryProgress(state, { planSummary: state.planSummary });
		emitActionProgress(state, "plan", "plan", "succeeded");
		emitStageProgress(state, "plan", "succeeded", "Plan completed");
		deps.loggerInfo(
			deps.buildIssueJobLogFields(state, "plan"),
			"Plan completed",
		);
		return;
	}

	const createdTasks = [];
	for (const task of parsedPlan.splitTasks) {
		const created = await taskClient.createTodoIssueFromPlan(state.issue, task);
		createdTasks.push({
			title: created.title,
			issueKey: created.identifier,
			issueUrl: created.url,
		});
	}
	state.splitTasks = createdTasks;
	Object.assign(state, deps.transitionStage(state, "done"));
	await deps.saveRunState(config.workspacePath, state);
	await taskClient.markStage(state.issue.id, "done");
	await taskClient.clearWorkflowStageLabels(state.issue.id);
	await taskClient.comment(
		state.issue.id,
		buildPlanSplitComment(state.issue.key, state.planSummary, createdTasks, {
			usage: result.usage,
		}),
	);
	await deps.safeNotifyTaskOutcome(notifications, state, "done");
	emitPlanningSummaryProgress(state, {
		planSummary: state.planSummary,
		splitTasks: parsedPlan.splitTasks,
	});
	emitActionProgress(state, "plan", "split-tasks", "succeeded", {
		detail: `${createdTasks.length} tasks created`,
	});
	emitActionProgress(state, "plan", "plan", "succeeded");
	emitStageProgress(state, "plan", "succeeded", "Plan completed");
	deps.loggerInfo(deps.buildIssueJobLogFields(state, "plan"), "Plan completed");
}

export async function resolveParentPlanningSessionId(
	workspacePath: string,
	projectId: string,
	state: RunState,
): Promise<string | undefined> {
	const parentIssueKey = state.issue.parentIssue?.key;
	if (!parentIssueKey) {
		return undefined;
	}
	const parentState = await loadRunState(
		workspacePath,
		projectId,
		parentIssueKey,
	);
	return parentState?.codexSessionId;
}

export function resolveReviewModeForComplexityScore(
	complexityScore: number,
): "bot" | "human" {
	return complexityScore < HUMAN_REVIEW_COMPLEXITY_THRESHOLD ? "bot" : "human";
}

export function shouldSquashMergePullRequestForComplexityScore(
	complexityScore: number,
): boolean {
	return complexityScore < HUMAN_REVIEW_COMPLEXITY_THRESHOLD;
}

function shouldRetryMalformedPlannerOutput(planSummary: string): boolean {
	return (
		!/(?:^|\n)\s*PLANNING_RESULT\s*:\s*(READY|NEEDS_INFO)\s*(?:\n|$)/i.test(
			planSummary,
		) && !/(?:^|\n)\s*SUCCESS_GOAL\s*:\s*[^\n]+\s*(?:\n|$)/i.test(planSummary)
	);
}
