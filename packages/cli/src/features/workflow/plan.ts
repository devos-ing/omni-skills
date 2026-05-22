import type { AgentAdapter } from "adapters";
import type {
	ResolvedNotificationConfig,
	ResolvedProjectConfig,
	RunState,
} from "../../features/types";
import { selectPlanningSupplementalSkills } from "../../skills/catalog";
import { buildPlanPrompt } from "../../skills/prompts";
import {
	buildPlanComment,
	buildPlanNeedsInfoComment,
	buildPlanSplitComment,
} from "../../utils/comments";
import { parsePlannerDecision } from "./plan-parsing";
import { applyPlannerIssueRefinement } from "./plan-refinement";
import { buildPlannerRepairPrompt } from "./plan-repair-prompt";
import type {
	HandlePlanningStageDeps,
	PlannerDecision,
	PlanningLinearClient,
} from "./plan.types";
import {
	emitActionProgress,
	emitPlanningSummaryProgress,
	emitStageProgress,
} from "./progress";
import { loadRunState } from "./state";

const HUMAN_REVIEW_COMPLEXITY_THRESHOLD = 5;
const DEFAULT_NEEDS_INFO_QUESTIONS = [
	"What outcome should this task accomplish, and how should review/testing verify it?",
];

export async function handlePlanningStage(
	config: ResolvedProjectConfig,
	agent: AgentAdapter,
	notifications: ResolvedNotificationConfig,
	linear: PlanningLinearClient,
	state: RunState,
	deps: HandlePlanningStageDeps,
): Promise<void> {
	deps.loggerInfo(
		deps.buildIssueJobLogFields(state, "planning"),
		"Planning issue",
	);
	emitStageProgress(state, "planning", "started", "Planning issue");
	emitActionProgress(state, "planning", "plan", "started");
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
		skillPath: config.skills.plan,
		prompt,
		invoke: () =>
			parentSessionId
				? agent.resume(parentSessionId, prompt)
				: agent.runPlan(prompt),
	});
	state.codexSessionId = result.sessionId ?? state.codexSessionId;
	state.planSummary = result.finalMessage || result.stdout;
	deps.appendCodexUsage(state, "planning", result.usage);
	await applyPlannerIssueRefinement(linear, state.issue, state.planSummary);

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
			skillPath: config.skills.plan,
			prompt: repairPrompt,
			invoke: () =>
				resumeSessionId
					? agent.resume(resumeSessionId, repairPrompt)
					: agent.runPlan(repairPrompt),
		});
		state.codexSessionId = result.sessionId ?? state.codexSessionId;
		state.planSummary = result.finalMessage || result.stdout;
		deps.appendCodexUsage(state, "planning", result.usage);
		await applyPlannerIssueRefinement(linear, state.issue, state.planSummary);
		try {
			parsedPlan = parsePlannerDecision(state.planSummary);
		} catch (retryError) {
			if (!shouldRetryMalformedPlannerOutput(state.planSummary)) {
				throw retryError;
			}
			parsedPlan = {
				result: "NEEDS_INFO",
				questions: DEFAULT_NEEDS_INFO_QUESTIONS,
			};
		}
	}
	if (parsedPlan.result === "NEEDS_INFO") {
		state.successGoal = undefined;
		state.complexityScore = undefined;
		state.reviewMode = undefined;
		state.planningNeedsInfoQuestions = parsedPlan.questions;
		state.failedStage = "planning";
		state.lastError = "Planning needs clarification before implementation.";
		Object.assign(state, deps.transitionStage(state, "blocked"));
		await deps.saveRunState(config.workspacePath, state);
		await linear.markStage(state.issue.id, "backlog");
		await linear.clearWorkflowStageLabels(state.issue.id);
		await linear.comment(
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
			"blocked",
			state.lastError,
		);
		emitActionProgress(state, "planning", "plan", "blocked", {
			detail: state.lastError,
		});
		emitStageProgress(state, "planning", "blocked", state.lastError);
		deps.loggerInfo(
			deps.buildIssueJobLogFields(state, "planning"),
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
		Object.assign(state, deps.transitionStage(state, "implementing"));
		await deps.saveRunState(config.workspacePath, state);
		await linear.markStage(state.issue.id, "implementing");
		await linear.comment(
			state.issue.id,
			buildPlanComment(state.issue.key, state.planSummary, result.usage),
		);
		emitPlanningSummaryProgress(state, { planSummary: state.planSummary });
		emitActionProgress(state, "planning", "plan", "succeeded");
		emitStageProgress(state, "planning", "succeeded", "Plan completed");
		deps.loggerInfo(
			deps.buildIssueJobLogFields(state, "planning"),
			"Plan completed",
		);
		return;
	}

	const createdTasks = [];
	for (const task of parsedPlan.splitTasks) {
		const created = await linear.createTodoIssueFromPlan(state.issue, task);
		createdTasks.push({
			title: created.title,
			issueKey: created.identifier,
			issueUrl: created.url,
		});
	}
	state.splitTasks = createdTasks;
	Object.assign(state, deps.transitionStage(state, "done"));
	await deps.saveRunState(config.workspacePath, state);
	await linear.markStage(state.issue.id, "backlog");
	await linear.clearWorkflowStageLabels(state.issue.id);
	await linear.comment(
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
	emitActionProgress(state, "planning", "split-tasks", "succeeded", {
		detail: `${createdTasks.length} tasks created`,
	});
	emitActionProgress(state, "planning", "plan", "succeeded");
	emitStageProgress(state, "planning", "succeeded", "Plan completed");
	deps.loggerInfo(
		deps.buildIssueJobLogFields(state, "planning"),
		"Plan completed",
	);
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
