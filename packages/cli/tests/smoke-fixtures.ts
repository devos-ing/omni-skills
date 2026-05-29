import type {
	PullRequestRef,
	ResolvedProjectConfig,
	RunState,
	WorkflowStage,
	WorkflowTaskRecord,
} from "../src/features/types";

const now = "2026-05-11T00:00:00.000Z";

export const passReview = "RESULT: PASS\nSUMMARY: clean\nBUGS_JSON: []";
export const failReview =
	'RESULT: FAIL\nSUMMARY: broken\nBUGS_JSON: [{"title":"Bug","body":"Fix it"}]';
export const simplePlan =
	"SUCCESS_GOAL: Ship the simple task.\nCOMPLEXITY: SIMPLE\nCOMPLEXITY_SCORE: 3\nShip it.";
export const humanPlan =
	"SUCCESS_GOAL: Complete the task with human approval.\nCOMPLEXITY: SIMPLE\nCOMPLEXITY_SCORE: 8\nNeeds eyes.";
export const complexPlan = [
	"SUCCESS_GOAL: Split the complex task into smaller issues.",
	"COMPLEXITY: COMPLEX",
	"COMPLEXITY_SCORE: 6",
	'SPLIT_TASKS_JSON: [{"title":"Part A"},{"title":"Part B"}]',
].join("\n");

export function issue(key: string, projectId = "default"): WorkflowTaskRecord {
	return {
		id: `task_${key}`,
		identifier: key,
		title: `${key} title`,
		url: `devos://tasks/${key}`,
		projectId,
		priority: { value: 1, name: "High" },
		state: { id: "assigned", name: "Assigned" },
		labels: [],
	};
}

export function state(
	project: ResolvedProjectConfig,
	key: string,
	stage: WorkflowStage | string,
	score = 3,
): RunState {
	return {
		projectId: project.id,
		projectName: project.name,
		workspacePath: project.executionPath,
		repository: project.repo,
		issue: { id: `task_${key}`, key, title: `${key} title`, url: "#" },
		stage: stage as WorkflowStage,
		complexityScore: score,
		reviewMode: "bot",
		pullRequest: pr(key),
		bugs: [],
		startedAt: now,
		updatedAt: now,
	};
}

export function project(id: string): ResolvedProjectConfig {
	return {
		id,
		name: id,
		workspacePath: "",
		executionPath: "",
		repo: { owner: "acme", name: id, baseBranch: "main" },
		github: { useGhCli: false, defaultBugLabel: "bug" },
		server: {
			database: {
				databasePath: ".devos/config/server-db",
				port: 54329,
			},
		},
		codex: { binary: "codex", streamLogs: false },
		skills: {
			root: "skills",
			brainstorm: "skills/piv-brainstorm/SKILL.md",
			plan: "skills/piv-plan/SKILL.md",
			implement: "skills/piv-implement/SKILL.md",
			reviewTest: "skills/piv-review-test/SKILL.md",
			githubComment: "skills/piv-github-comment/SKILL.md",
		},
		workflow: {
			issueConcurrency: 1,
		},
		dryRun: true,
	};
}

export function pr(key: string): PullRequestRef {
	return {
		branch: `codex/${key.toLowerCase()}`,
		title: key,
		url: `https://github.example/pull/${key}`,
	};
}
