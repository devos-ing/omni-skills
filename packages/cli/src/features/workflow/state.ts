import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RunState, WorkflowStage } from "../types";

type MaybeLegacyRunState = Omit<RunState, "stage" | "failedStage"> & {
	stage: WorkflowStage | string;
	failedStage?: WorkflowStage | string;
};

const LEGACY_STATE_DIR = path.join(".devos", "runs");
const STATE_ROOT_DIR = path.join(".devos", "projects");

export function normalizeIssueKey(input: string): string {
	const trimmed = input.trim();
	const taskMatch = trimmed.match(/TASK\(([^)]+)\)-([1-9]\d*)/i);
	if (taskMatch) {
		return `TASK(${taskMatch[1].toUpperCase()})-${taskMatch[2]}`;
	}
	const match = trimmed.match(/[A-Z]+-\d+/);
	if (!match) {
		return trimmed.toUpperCase();
	}
	return match[0].toUpperCase();
}

export function stateFilePath(
	cwd: string,
	projectId: string,
	issueKey: string,
): string {
	return path.join(
		cwd,
		STATE_ROOT_DIR,
		projectId,
		"runs",
		`${normalizeIssueKey(issueKey)}.json`,
	);
}

export async function loadRunState(
	cwd: string,
	projectId: string,
	issueKey: string,
): Promise<RunState | null> {
	const file = stateFilePath(cwd, projectId, issueKey);
	try {
		const raw = await readFile(file, "utf8");
		return normalizeLoadedRunState(JSON.parse(raw) as RunState);
	} catch {
		if (projectId !== "default") {
			return null;
		}
		const legacy = path.join(
			cwd,
			LEGACY_STATE_DIR,
			`${normalizeIssueKey(issueKey)}.json`,
		);
		try {
			const raw = await readFile(legacy, "utf8");
			return normalizeLoadedRunState(JSON.parse(raw) as RunState);
		} catch {
			return null;
		}
	}
}

export async function saveRunState(
	cwd: string,
	state: RunState,
): Promise<void> {
	const file = stateFilePath(cwd, state.projectId, state.issue.key);
	await mkdir(path.dirname(file), { recursive: true });
	state.updatedAt = new Date().toISOString();
	await writeFile(file, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export async function listRunStates(
	cwd: string,
	projectId: string,
): Promise<RunState[]> {
	const dir = path.join(cwd, STATE_ROOT_DIR, projectId, "runs");
	try {
		const files = await readdir(dir);
		const runs: RunState[] = [];
		for (const file of files) {
			if (!file.endsWith(".json")) {
				continue;
			}
			const raw = await readFile(path.join(dir, file), "utf8");
			runs.push(JSON.parse(raw) as RunState);
		}
		return runs;
	} catch {
		return [];
	}
}

export function transitionStage(
	state: RunState,
	next: WorkflowStage,
): RunState {
	return {
		...state,
		stage: next,
		updatedAt: new Date().toISOString(),
	};
}

export function normalizeBlockedPlanningFailureForResume(
	state: MaybeLegacyRunState,
): RunState {
	if (!shouldResumeBlockedPlanningFailure(state)) {
		return normalizeRunStateStages(state);
	}
	return {
		...state,
		stage: "plan",
		failedStage: "plan",
		planSummary: undefined,
		successGoal: undefined,
		complexityScore: undefined,
		reviewMode: undefined,
	};
}

export function shouldResumeBlockedPlanningFailure(
	state: MaybeLegacyRunState,
): boolean {
	const rawStage = String(state.stage);
	if (rawStage !== "blocked") {
		return false;
	}
	const failedStage = String(state.failedStage);
	if (failedStage === "planning" || failedStage === "plan") {
		return true;
	}
	return (
		!state.successGoal &&
		Boolean(
			state.lastError?.startsWith("Planner output must include SUCCESS_GOAL"),
		)
	);
}

function normalizeLoadedRunState(state: MaybeLegacyRunState): RunState {
	const legacyStage = String(state.stage);
	if (shouldResumeBlockedPlanningFailure(state)) {
		return {
			...normalizeRunStateStages(state),
			stage: "plan",
			failedStage: "plan",
			planSummary: undefined,
			successGoal: undefined,
			complexityScore: undefined,
			reviewMode: undefined,
		};
	}
	return normalizeRunStateStages({
		...state,
		stage: normalizeWorkflowStage(legacyStage),
		failedStage: state.failedStage
			? normalizeWorkflowStage(String(state.failedStage))
			: undefined,
	});
}

function normalizeRunStateStages(state: MaybeLegacyRunState): RunState {
	return {
		...state,
		stage: normalizeWorkflowStage(String(state.stage)),
		failedStage: state.failedStage
			? normalizeWorkflowStage(String(state.failedStage))
			: undefined,
	};
}

function normalizeWorkflowStage(stage: string): WorkflowStage {
	if (stage === "brainstorming") {
		return "brainstorm";
	}
	if (stage === "received" || stage === "planning") {
		return "plan";
	}
	if (stage === "implementing") {
		return "in_progress";
	}
	if (
		stage === "pr_created" ||
		stage === "reviewing" ||
		stage === "testing" ||
		stage === "human_review"
	) {
		return "in_review";
	}
	if (stage === "blocked") {
		return "failed";
	}
	if (
		stage === "backlog" ||
		stage === "brainstorm" ||
		stage === "plan" ||
		stage === "in_progress" ||
		stage === "in_review" ||
		stage === "canceled" ||
		stage === "done" ||
		stage === "failed"
	) {
		return stage;
	}
	return "failed";
}
