import type { AgentAdapter } from "../agent-adapters";
import { selectPlanningSupplementalSkills } from "../skills/catalog";
import { buildPlanPrompt } from "../skills/prompts";
import { buildPlanComment, buildPlanSplitComment } from "../utils/comments";
import type {
	HandlePlanningStageDeps,
	PlannerDecision,
	PlannerIssueRefinement,
	PlanningLinearClient,
} from "./plan.types";
import type {
	IssueRef,
	PlannedSplitTask,
	ResolvedNotificationConfig,
	ResolvedProjectConfig,
	RunState,
} from "./types";
export type {
	HandlePlanningStageDeps,
	PlannerDecision,
	PlannerIssueRefinement,
	PlanningLinearClient,
} from "./plan.types";

const DEFAULT_PLANNER_COMPLEXITY_SCORE = 4;
const HUMAN_REVIEW_COMPLEXITY_THRESHOLD = 5;

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
	const supplemental = await selectPlanningSupplementalSkills(
		config,
		state.issue,
	);
	const prompt = await buildPlanPrompt(config.skills.plan, state.issue, {
		supplementalSkills: supplemental.selected,
		autoSelectWarnings: supplemental.warnings,
	});
	const result = await deps.runAgentWithChatLog({
		workspacePath: config.workspacePath,
		projectId: config.id,
		issue: state.issue,
		agentRole: "planning",
		skillPath: config.skills.plan,
		prompt,
		invoke: () => agent.runPlan(prompt),
	});
	state.codexSessionId = result.sessionId ?? state.codexSessionId;
	state.planSummary = result.finalMessage || result.stdout;
	deps.appendCodexUsage(state, "planning", result.usage);
	await applyPlannerIssueRefinement(linear, state.issue, state.planSummary);

	const parsedPlan = parsePlannerDecision(state.planSummary);
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
	deps.loggerInfo(
		deps.buildIssueJobLogFields(state, "planning"),
		"Plan completed",
	);
}

export function parsePlannerDecision(planSummary: string): PlannerDecision {
	const complexity = parsePlannerComplexity(planSummary);
	const complexityScore = parsePlannerComplexityScore(planSummary);
	if (complexity === "SIMPLE") {
		return { complexity, splitTasks: [], complexityScore };
	}
	return {
		complexity,
		splitTasks: parsePlannerSplitTasks(planSummary),
		complexityScore,
	};
}

export function parsePlannerComplexity(
	planSummary: string,
): "SIMPLE" | "COMPLEX" {
	const match = planSummary.match(
		/(?:^|\n)\s*COMPLEXITY\s*:\s*(SIMPLE|COMPLEX)\s*(?:\n|$)/i,
	);
	if (!match?.[1]) {
		return "SIMPLE";
	}
	return match[1].toUpperCase() === "COMPLEX" ? "COMPLEX" : "SIMPLE";
}

export function parsePlannerComplexityScore(planSummary: string): number {
	const match = planSummary.match(
		/(?:^|\n)\s*COMPLEXITY_SCORE\s*:\s*([^\n]+)\s*(?:\n|$)/i,
	);
	if (!match?.[1]) {
		return DEFAULT_PLANNER_COMPLEXITY_SCORE;
	}
	const rawScore = match[1].trim();
	if (!/^\d+$/.test(rawScore)) {
		throw new Error(
			`Invalid COMPLEXITY_SCORE '${rawScore}'. Expected an integer between 0 and 10.`,
		);
	}
	const score = Number(rawScore);
	if (!Number.isInteger(score) || score < 0 || score > 10) {
		throw new Error(
			`Invalid COMPLEXITY_SCORE '${rawScore}'. Expected an integer between 0 and 10.`,
		);
	}
	return score;
}

export function parsePlannerIssueRefinement(
	planSummary: string,
): PlannerIssueRefinement | null {
	const marker = /\bISSUE_REFINEMENT_JSON\s*:/i;
	const markerMatch = marker.exec(planSummary);
	if (!markerMatch) {
		return null;
	}
	const markerStart = markerMatch.index + markerMatch[0].length;
	const rawPayload = planSummary.slice(markerStart).trim();
	if (!rawPayload) {
		throw new Error(
			"Planner included ISSUE_REFINEMENT_JSON marker but no JSON payload.",
		);
	}
	const jsonSource = unwrapFencedCodeBlock(rawPayload);
	const jsonObjectText = extractFirstJsonObject(jsonSource);
	if (!jsonObjectText) {
		throw new Error(
			"ISSUE_REFINEMENT_JSON must contain a JSON object with title and description.",
		);
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonObjectText);
	} catch (error) {
		throw new Error(
			`Failed to parse ISSUE_REFINEMENT_JSON: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error("ISSUE_REFINEMENT_JSON must be a JSON object.");
	}
	const record = parsed as Record<string, unknown>;
	const title =
		typeof record.title === "string" ? record.title.trim() : undefined;
	const description =
		typeof record.description === "string"
			? record.description.trim()
			: undefined;
	if (!title) {
		throw new Error("ISSUE_REFINEMENT_JSON.title must be a non-empty string.");
	}
	if (!description) {
		throw new Error(
			"ISSUE_REFINEMENT_JSON.description must be a non-empty string.",
		);
	}
	return { title, description };
}

export async function applyPlannerIssueRefinement(
	linear: Pick<PlanningLinearClient, "updateIssueDetails">,
	issue: IssueRef,
	planSummary: string,
): Promise<boolean> {
	const refinement = parsePlannerIssueRefinement(planSummary);
	if (!refinement) {
		return false;
	}
	const currentDescription = issue.description?.trim() ?? "";
	if (
		issue.title.trim() === refinement.title &&
		currentDescription === refinement.description
	) {
		return false;
	}
	await linear.updateIssueDetails(
		issue.id,
		refinement.title,
		refinement.description,
	);
	issue.title = refinement.title;
	issue.description = refinement.description;
	return true;
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

export function parsePlannerSplitTasks(
	planSummary: string,
): PlannedSplitTask[] {
	const marker = /\bSPLIT_TASKS_JSON\s*:/i;
	const markerMatch = marker.exec(planSummary);
	if (!markerMatch) {
		throw new Error(
			"Planner marked task as COMPLEX but omitted SPLIT_TASKS_JSON.",
		);
	}
	const markerStart = markerMatch.index + markerMatch[0].length;
	const rawPayload = planSummary.slice(markerStart).trim();
	if (!rawPayload) {
		throw new Error(
			"Planner marked task as COMPLEX but SPLIT_TASKS_JSON was empty.",
		);
	}
	const jsonSource = unwrapFencedCodeBlock(rawPayload);
	const jsonArrayText = extractFirstJsonArray(jsonSource);
	if (!jsonArrayText) {
		throw new Error(
			"Planner marked task as COMPLEX but SPLIT_TASKS_JSON did not contain a JSON array.",
		);
	}
	const parsed = JSON.parse(jsonArrayText) as unknown;
	if (!Array.isArray(parsed) || parsed.length === 0) {
		throw new Error(
			"SPLIT_TASKS_JSON must be a non-empty JSON array when COMPLEXITY is COMPLEX.",
		);
	}
	return parsed.map((value, index) => validateSplitTask(value, index));
}

function validateSplitTask(value: unknown, index: number): PlannedSplitTask {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`Split task at index ${index} must be an object.`);
	}
	const record = value as Record<string, unknown>;
	const title =
		typeof record.title === "string" ? record.title.trim() : undefined;
	if (!title) {
		throw new Error(
			`Split task at index ${index} is missing a non-empty title.`,
		);
	}
	const description =
		typeof record.description === "string"
			? record.description.trim() || undefined
			: undefined;
	const labels = parseSplitTaskLabels(record.labels, index);
	const priority = parseSplitTaskPriority(record.priority, index);
	return { title, description, labels, priority };
}

function parseSplitTaskLabels(
	rawLabels: unknown,
	index: number,
): string[] | undefined {
	if (rawLabels === undefined) {
		return undefined;
	}
	if (!Array.isArray(rawLabels)) {
		throw new Error(`Split task at index ${index} has non-array labels.`);
	}
	const labels = rawLabels
		.map((label, labelIndex) => {
			if (typeof label !== "string") {
				throw new Error(
					`Split task at index ${index} has non-string label at position ${labelIndex}.`,
				);
			}
			return label.trim();
		})
		.filter(Boolean);
	return labels.length > 0 ? labels : undefined;
}

function parseSplitTaskPriority(
	rawPriority: unknown,
	index: number,
): number | undefined {
	if (rawPriority === undefined) {
		return undefined;
	}
	if (
		typeof rawPriority !== "number" ||
		!Number.isInteger(rawPriority) ||
		rawPriority < 0 ||
		rawPriority > 4
	) {
		throw new Error(
			`Split task at index ${index} has invalid priority '${String(rawPriority)}'. Expected integer 0-4.`,
		);
	}
	return rawPriority;
}

function unwrapFencedCodeBlock(input: string): string {
	if (!input.startsWith("```")) {
		return input;
	}
	const firstNewline = input.indexOf("\n");
	if (firstNewline === -1) {
		return input;
	}
	const closingFence = input.indexOf("\n```", firstNewline + 1);
	if (closingFence === -1) {
		return input.slice(firstNewline + 1);
	}
	return input.slice(firstNewline + 1, closingFence).trim();
}

function extractFirstJsonArray(input: string): string | null {
	const start = input.indexOf("[");
	if (start === -1) {
		return null;
	}
	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let i = start; i < input.length; i += 1) {
		const char = input[i];
		if (!char) {
			continue;
		}
		if (inString) {
			if (escaped) {
				escaped = false;
				continue;
			}
			if (char === "\\") {
				escaped = true;
				continue;
			}
			if (char === '"') {
				inString = false;
			}
			continue;
		}
		if (char === '"') {
			inString = true;
			continue;
		}
		if (char === "[") {
			depth += 1;
			continue;
		}
		if (char === "]") {
			depth -= 1;
			if (depth === 0) {
				return input.slice(start, i + 1);
			}
		}
	}
	return null;
}

function extractFirstJsonObject(input: string): string | null {
	const start = input.indexOf("{");
	if (start === -1) {
		return null;
	}
	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let i = start; i < input.length; i += 1) {
		const char = input[i];
		if (!char) {
			continue;
		}
		if (inString) {
			if (escaped) {
				escaped = false;
				continue;
			}
			if (char === "\\") {
				escaped = true;
				continue;
			}
			if (char === '"') {
				inString = false;
			}
			continue;
		}
		if (char === '"') {
			inString = true;
			continue;
		}
		if (char === "{") {
			depth += 1;
			continue;
		}
		if (char === "}") {
			depth -= 1;
			if (depth === 0) {
				return input.slice(start, i + 1);
			}
		}
	}
	return null;
}
