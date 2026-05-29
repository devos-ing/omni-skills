import { describe, expect, it } from "bun:test";
import type {
	AgentAdapter,
	AgentAdapterRunRequest,
	AgentResult,
} from "adapters";
import type { LoadedConfig } from "../src/features/config";
import type { ResolvedProjectConfig } from "../src/features/types";
import { AgentAdapterBridge } from "../src/features/workflow/agents/agent-adapter-bridge";
import { WorkflowManager } from "../src/features/workflow/management/workflow-manager";
import { MissionManager } from "../src/features/workflow/mission/mission-manager";
import { createBuiltInWorkflowMetadata } from "../src/features/workflow/pipeline/built-in-workflow-metadata";
import { PhaseRunner } from "../src/features/workflow/pipeline/phase-runner";
import { PipelineManager } from "../src/features/workflow/pipeline/pipeline-manager";

describe("workflow managers", () => {
	it("routes stage agents through the structured adapter contract", async () => {
		const calls: string[] = [];
		const adapter = fakeAgentAdapter(async (method) => {
			calls.push(method);
			return { finalMessage: method, stdout: method };
		});
		const bridge = new AgentAdapterBridge(adapter, fakeProject());

		await bridge
			.createAgent("planning")
			.run({ role: "planning", prompt: "plan" });
		await bridge
			.createAgent("implementing")
			.run({ role: "implementing", prompt: "fix", sessionId: "s1" });

		expect(calls).toEqual(["runAgent:planning", "runAgent:implementing"]);
	});

	it("owns project cycle orchestration without changing polling semantics", async () => {
		const events: string[] = [];
		const project = fakeProject();
		const config = { projects: [project], polling: {}, notifications: {} };
		const manager = new WorkflowManager(
			config as LoadedConfig,
			{},
			{
				createTaskClient: () => fakeLinearClient(),
			} as never,
			{
				resolvePolling: () => ({
					enabled: false,
					intervalMs: 1,
					exitWhenIdle: true,
					staleRunTimeoutMs: 1,
				}),
				pickProjects: () => [project],
				usesAllProjectScope: () => false,
				routeProjectContextsForTargetIssue: async (contexts) => contexts,
				handleNoProjectSelection: async () => {
					events.push("none");
				},
				runProjectCycle: async () => {
					events.push("cycle");
					return 0;
				},
				handleProjectCycleError: async () => {
					events.push("error");
				},
				shouldStopPolling: () => true,
				handlePollingStopped: async () => {
					events.push("stopped");
				},
				sleepForWorkflow: async () => {
					events.push("sleep");
				},
			},
		);

		await manager.run();

		expect(events).toEqual(["cycle", "stopped"]);
	});

	it("models built-in metadata as brainstorm, plan, implement, and testing phases", () => {
		const metadata = createBuiltInWorkflowMetadata(fakeProject());

		expect(metadata.phases.map((phase) => phase.id)).toEqual([
			"brainstorm",
			"plan",
			"implement",
			"testing",
		]);
		expect(metadata.phases.flatMap((phase) => phase.agentAssignments)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: "brainstormer", role: "brainstorm" }),
				expect.objectContaining({ name: "planner", role: "planning" }),
				expect.objectContaining({
					name: "implementer",
					role: "implementing",
				}),
				expect.objectContaining({ name: "reviewer", role: "review-testing" }),
			]),
		);
	});

	it("runs multiple agents in a phase before moving to the next phase", async () => {
		const events: string[] = [];
		const phaseRunner = new PhaseRunner({
			runAgent: async ({ phase, assignment }) => {
				events.push(`${phase.id}:${assignment.name}`);
				return {
					assignment,
					result: { stdout: assignment.name, finalMessage: assignment.name },
				};
			},
		});
		const metadata = createBuiltInWorkflowMetadata(fakeProject());
		const planPhaseIndex = metadata.phases.findIndex(
			(phase) => phase.id === "plan",
		);
		metadata.phases[planPhaseIndex] = {
			...metadata.phases[planPhaseIndex],
			agentAssignments: [
				{ name: "a", role: "planning", required: true, skills: [] },
				{ name: "b", role: "planning", required: true, skills: [] },
			],
		};
		const pipeline = new PipelineManager(metadata, { phaseRunner });
		const state = fakeRunState("plan");

		const result = await pipeline.run({
			config: fakeProject(),
			state,
			shouldContinue: () => state.stage === "plan",
			afterPhase: async () => {
				state.stage = "done";
			},
		});

		expect(result.ok).toBe(true);
		expect(events.sort()).toEqual(["plan:a", "plan:b"]);
	});

	it("creates an internal mission from a task and run state", () => {
		const project = fakeProject();
		const issue = fakeIssue("eng-7");
		const state = fakeRunState("plan");

		const mission = new MissionManager(project).createMission({
			issue,
			state,
			resumed: true,
		});

		expect(mission).toMatchObject({
			id: "default:ENG-7",
			key: "ENG-7",
			projectId: "default",
			resumed: true,
		});
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

function fakeIssue(identifier: string) {
	return {
		id: "issue-1",
		identifier,
		title: "Build workflow",
		url: "devos://tasks/issue-1",
		priority: { value: 1, name: "P1" },
		labels: [],
		state: { id: "plan", name: "plan" },
	};
}

function fakeRunState(stage: "plan" | "done") {
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
