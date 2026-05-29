import { describe, expect, it, mock } from "bun:test";
import type { AgentAdapter } from "adapters";
import type { ResolvedProjectConfig, RunState } from "../src/features/types";
import { handleBrainstormStage } from "../src/features/workflow/brainstorm/brainstorm";
import { parseBrainstormDecision } from "../src/features/workflow/brainstorm/brainstorm-parser";

describe("parseBrainstormDecision", () => {
	it("parses READY and NEEDS_INFO outputs", () => {
		expect(
			parseBrainstormDecision(
				"BRAINSTORM_RESULT: READY\nSUMMARY: Smallest coherent scope.",
			),
		).toEqual({
			result: "ready",
			summary: "Smallest coherent scope.",
		});

		expect(
			parseBrainstormDecision(
				[
					"BRAINSTORM_RESULT: NEEDS_INFO",
					"QUESTIONS_JSON:",
					JSON.stringify([
						{
							question: "Which boundary owns this?",
							options: [
								{
									label: "Workflow phase",
									value: "workflow phase",
									recommended: true,
								},
							],
						},
					]),
				].join("\n"),
			),
		).toEqual({
			result: "needs_info",
			questions: [
				{
					question: "Which boundary owns this?",
					options: [
						{
							label: "Workflow phase",
							value: "workflow phase",
							recommended: true,
						},
					],
				},
			],
		});
	});
});

describe("handleBrainstormStage", () => {
	it("records READY output and transitions to planning", async () => {
		const runAgent = mock(async () => ({
			finalMessage:
				"BRAINSTORM_RESULT: READY\nSUMMARY: Smallest coherent scope.",
			stdout: "",
			sessionId: "brainstorm-session",
		}));
		const saveRunState = mock(async () => {});
		const state = createRunState();

		await handleBrainstormStage(
			createProject(),
			createAgent(runAgent),
			createTaskClient(),
			state,
			createDeps(saveRunState),
		);

		expect(state).toMatchObject({
			brainstormSummary: "Smallest coherent scope.",
			codexSessionId: "brainstorm-session",
			stage: "plan",
		});
		expect(runAgent).toHaveBeenCalledWith(
			expect.objectContaining({
				role: "brainstorm",
				skills: [{ name: "brainstorm", path: "/tmp/brainstorm.md" }],
			}),
		);
		expect(saveRunState).toHaveBeenCalledWith("/tmp/workspace", state);
	});

	it("publishes NEEDS_INFO questions to the linked chat session", async () => {
		const questions = [
			{
				question: "Which boundary owns this?",
				options: [
					{
						label: "Workflow phase",
						value: "workflow phase",
						recommended: true,
					},
				],
			},
		];
		const taskClient = createTaskClient();
		const state = createRunState();

		await handleBrainstormStage(
			createProject(),
			createAgent(
				mock(async () => ({
					finalMessage: [
						"BRAINSTORM_RESULT: NEEDS_INFO",
						"QUESTIONS_JSON:",
						JSON.stringify(questions),
					].join("\n"),
					stdout: "",
				})),
			),
			taskClient,
			state,
			createDeps(mock(async () => {})),
		);

		expect(state).toMatchObject({
			brainstormNeedsInfoQuestions: questions,
			stage: "brainstorm",
		});
		expect(taskClient.publishChatClarification).toHaveBeenCalledWith(
			"task-1",
			questions,
		);
	});
});

function createProject(): ResolvedProjectConfig {
	return {
		id: "default",
		name: "Default",
		workspacePath: "/tmp/workspace",
		executionPath: "/tmp/workspace",
		repo: { owner: "acme", name: "repo", baseBranch: "main" },
		github: { useGhCli: true, defaultBugLabel: "bug" },
		server: { database: { databasePath: "/tmp/devos.sqlite", port: 0 } },
		codex: { binary: "codex", streamLogs: false },
		workflow: { issueConcurrency: 1 },
		skills: {
			root: "/tmp/skills",
			brainstorm: "/tmp/brainstorm.md",
			plan: "/tmp/plan.md",
			implement: "/tmp/implement.md",
			reviewTest: "/tmp/review.md",
			githubComment: "/tmp/comment.md",
		},
		dryRun: true,
	} as ResolvedProjectConfig;
}

function createRunState(): RunState {
	const now = "2026-05-29T00:00:00.000Z";
	return {
		projectId: "default",
		projectName: "Default",
		workspacePath: "/tmp/workspace",
		repository: { owner: "acme", name: "repo", baseBranch: "main" },
		issue: {
			id: "task-1",
			key: "PIV-1",
			title: "Enhance PIV flow",
			description: "Add brainstorm before planning.",
			url: "devos://tasks/task-1",
		},
		stage: "brainstorm" as RunState["stage"],
		bugs: [],
		startedAt: now,
		updatedAt: now,
	};
}

function createAgent(runAgent: AgentAdapter["runAgent"]): AgentAdapter {
	return {
		runAgent,
		runPlan: mock(async () => ({ finalMessage: "", stdout: "" })),
		runTaskIntake: mock(async () => ({ finalMessage: "", stdout: "" })),
		resume: mock(async () => ({ finalMessage: "", stdout: "" })),
		runReview: mock(async () => ({ finalMessage: "", stdout: "" })),
		runGithubComment: mock(async () => ({ finalMessage: "", stdout: "" })),
	};
}

function createTaskClient() {
	return {
		listChatClarificationAnswers: mock(async () => []),
		publishChatClarification: mock(async () => {}),
	};
}

function createDeps(saveRunState: ReturnType<typeof mock>) {
	type AgentResult = {
		finalMessage: string;
		stdout: string;
		sessionId?: string;
	};
	return {
		appendCodexUsage: () => {},
		buildIssueJobLogFields: () => ({}),
		loggerInfo: () => {},
		runAgentWithChatLog: async ({
			invoke,
		}: { invoke: () => Promise<AgentResult> }) => invoke(),
		saveRunState,
		transitionStage: (state: RunState, next: RunState["stage"]) =>
			({ ...state, stage: next }) as RunState,
	};
}
