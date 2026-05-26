import { describe, expect, it } from "bun:test";
import type { AgentAdapter, AgentResult } from "adapters";
import type { LoadedConfig } from "../src/features/config";
import type { ResolvedProjectConfig } from "../src/features/types";
import { AgentAdapterBridge } from "../src/features/workflow/oop/agent-adapter-bridge";
import { WorkflowOrchestrator } from "../src/features/workflow/oop/workflow-orchestrator";

describe("workflow OOP bridge", () => {
	it("routes stage agents through the existing adapter contract", async () => {
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

		expect(calls).toEqual(["runPlan", "resume"]);
	});

	it("owns project cycle orchestration without changing polling semantics", async () => {
		const events: string[] = [];
		const project = fakeProject();
		const config = { projects: [project], polling: {}, notifications: {} };
		const orchestrator = new WorkflowOrchestrator(
			config as LoadedConfig,
			{},
			{
				createLinearClient: () => fakeLinearClient(),
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

		await orchestrator.run();

		expect(events).toEqual(["cycle", "stopped"]);
	});
});

function fakeAgentAdapter(
	run: (method: string) => Promise<AgentResult>,
): AgentAdapter {
	return {
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
		linear: {
			apiKey: "",
			apiUrl: "",
			pollLimit: 10,
			statusMap: {
				backlog: "backlog",
				assigned: "assigned",
				plan: "plan",
				in_progress: "in_progress",
				in_review: "in_review",
				canceled: "canceled",
				failed: "failed",
				done: "done",
			},
			labelMap: {},
			autoCreateLabels: false,
		},
		github: { useGhCli: true, defaultBugLabel: "bug" },
		server: { database: { databasePath: "/tmp/devos.sqlite", port: 0 } },
		codex: { binary: "codex", streamLogs: false },
		workflow: { issueConcurrency: 1 },
		skills: {
			root: "skills",
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
