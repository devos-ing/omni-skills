import { describe, expect, it } from "bun:test";
import type {
	AgentAdapter,
	AgentAdapterRunRequest,
	AgentResult,
} from "adapters";
import type { ResolvedProjectConfig, RunState } from "../src/features/types";
import { createBuiltInWorkflowMetadata } from "../src/features/workflow/pipeline/built-in-workflow-metadata";
import { BuiltInWorkflowPhaseRunner } from "../src/features/workflow/pipeline/built-in-workflow-phase-runner";
import { PhaseRunner } from "../src/features/workflow/pipeline/phase-runner";
import { PipelineManager } from "../src/features/workflow/pipeline/pipeline-manager";

describe("workflow pipeline", () => {
	it("records skipped phases and stops when skip leaves the stage unchanged", async () => {
		let beforePhaseCalls = 0;
		const phaseRunner = new PhaseRunner({
			runAgent: async () => {
				throw new Error("phase runner should not execute skipped phases");
			},
		});
		const metadata = createBuiltInWorkflowMetadata(fakeProject());
		const pipeline = new PipelineManager(metadata, { phaseRunner });
		const state = fakeRunState("plan");

		const result = await pipeline.run({
			config: fakeProject(),
			state,
			shouldContinue: () => beforePhaseCalls < 2 && state.stage === "plan",
			beforePhase: async () => {
				beforePhaseCalls += 1;
				return "skip";
			},
		});

		expect(result.ok).toBe(true);
		expect(beforePhaseCalls).toBe(1);
		const planPhase = metadata.phases.find((phase) => phase.id === "plan");
		if (!planPhase) {
			throw new Error("Expected built-in metadata to include the plan phase");
		}
		expect(result.phaseResults).toEqual([
			{ status: "skipped", phase: planPhase },
		]);
	});

	it("dispatches built-in workflow phases through injected handlers", async () => {
		const events: string[] = [];
		const runner = new BuiltInWorkflowPhaseRunner({} as never, {
			plan: async ({ phaseId }) => {
				events.push(phaseId);
			},
			implement: async ({ phaseId }) => {
				events.push(phaseId);
			},
			testing: async ({ phaseId }) => {
				events.push(phaseId);
			},
		});
		const input = {
			config: fakeProject(),
			agent: fakeAgentAdapter(async () => ({
				finalMessage: "unused",
				stdout: "unused",
			})),
			notifications: fakeNotifications(),
			taskClient: fakeLinearClient(),
			state: fakeRunState("plan"),
		};

		await runner.run({ ...input, phaseId: "plan" });
		await runner.run({
			...input,
			phaseId: "implement",
			state: fakeRunState("in_progress"),
		});
		await runner.run({
			...input,
			phaseId: "testing",
			state: fakeRunState("in_review"),
		});

		expect(events).toEqual(["plan", "implement", "testing"]);
	});
});

function fakeAgentAdapter(
	run: (method: string) => Promise<AgentResult>,
): AgentAdapter {
	return {
		runAgent: (request: AgentAdapterRunRequest) =>
			run(`runAgent:${request.role}`),
		runPlan: () => run("runPlan"),
		runTaskIntake: () => run("runTaskIntake"),
		resume: () => run("resume"),
		runReview: () => run("runReview"),
		runGithubComment: () => run("runGithubComment"),
	};
}

function fakeNotifications() {
	return {
		email: {
			enabled: false,
			to: [],
		},
	};
}

function fakeLinearClient() {
	return {
		fetchWork: async () => [],
		fetchIssueByIdentifier: async () => null,
		fetchReviewOnlyWork: async () => [],
		isAssignedState: async () => true,
		markStage: async () => undefined,
		markCanceled: async () => undefined,
		createBacklogTask: async () => ({
			id: "1",
			identifier: "T-1",
			title: "t",
			url: "u",
		}),
		createTodoIssueFromPlan: async () => ({
			id: "1",
			identifier: "T-1",
			title: "t",
			url: "u",
		}),
		applyStageLabel: async () => undefined,
		clearWorkflowStageLabels: async () => undefined,
		comment: async () => undefined,
	};
}

function fakeProject(): ResolvedProjectConfig {
	return {
		id: "default",
		name: "Default",
		workspacePath: "/tmp/workspace",
		executionPath: "/tmp/workspace",
		repo: { owner: "o", name: "r", baseBranch: "main" },
		github: { useGhCli: true, defaultBugLabel: "bug" },
		server: { database: { databasePath: "/tmp/devos.sqlite", port: 0 } },
		codex: { binary: "codex", streamLogs: false },
		workflow: { issueConcurrency: 1 },
		skills: {
			root: "skills",
			brainstorm: "brainstorm",
			plan: "plan",
			implement: "implement",
			reviewTest: "review",
			githubComment: "comment",
		},
		dryRun: true,
	};
}

function fakeRunState(stage: RunState["stage"]): RunState {
	return {
		projectId: "default",
		projectName: "Default",
		workspacePath: "/tmp/workspace",
		repository: { owner: "o", name: "r", baseBranch: "main" },
		issue: {
			id: "issue-1",
			key: "ENG-7",
			title: "Build workflow",
			url: "devos://tasks/issue-1",
		},
		stage,
		bugs: [],
		startedAt: "2026-05-27T00:00:00.000Z",
		updatedAt: "2026-05-27T00:00:00.000Z",
	};
}
