import { describe, expect, it } from "bun:test";
import type { LoadedConfig } from "../src/features/config";
import type { ResolvedProjectConfig, RunOptions } from "../src/features/types";
import { ProjectContextResolver } from "../src/features/workflow/management/project-context-resolver";
import { pickProjects } from "../src/features/workflow/management/project-selection";
import { WorkflowScheduler } from "../src/features/workflow/management/workflow-scheduler";
import type { PollingSettings } from "../src/features/workflow/types/workflow.types";

describe("workflow management layers", () => {
	it("defaults to every configured project when no explicit project is selected", () => {
		const api = fakeProject("api");
		const web = fakeProject("web");

		const projects = pickProjects(fakeConfig([api, web]), {}, fakePolling());

		expect(projects.map((project) => project.id)).toEqual(["api", "web"]);
	});

	it("resolves project contexts before workflow scheduling", async () => {
		const events: string[] = [];
		const api = fakeProject("api");
		const web = fakeProject("web");
		const runtime = {
			createTaskClient: (project: ResolvedProjectConfig) => ({
				projectId: project.id,
			}),
		};
		const resolver = new ProjectContextResolver(
			fakeConfig([api, web]),
			{ issueArg: "ENG-7", allProjects: true },
			runtime as never,
			{
				pickProjects: () => [api, web],
				usesAllProjectScope: () => true,
				routeProjectContextsForTargetIssue: async (contexts, issueArg) => {
					events.push(`route:${issueArg}:${contexts.length}`);
					return contexts.filter((context) => context.config.id === "web");
				},
				handleNoProjectSelection: async () => {
					events.push("none");
				},
			},
		);

		const contexts = await resolver.resolve(fakePolling({ enabled: true }));

		expect(contexts?.map((context) => context.config.id)).toEqual(["web"]);
		expect(events).toEqual(["route:ENG-7:2"]);
	});

	it("runs polling cycles outside per-issue workflow execution", async () => {
		const events: string[] = [];
		const scheduler = new WorkflowScheduler(
			{},
			{
				sleep: async (ms: number) => {
					events.push(`sleep:${ms}`);
				},
			} as never,
			{
				runProjectCycle: async ({ project, cycle }) => {
					events.push(`cycle:${project.id}:${cycle}`);
					return cycle === 1 ? 1 : 0;
				},
				handleProjectCycleError: async () => {
					events.push("error");
				},
				shouldStopPolling: ({ cycle }) => cycle >= 2,
				handlePollingStopped: async ({ totalIssues }) => {
					events.push(`stopped:${totalIssues}`);
				},
				sleepForWorkflow: async (runtime, ms) => {
					await runtime.sleep?.(ms);
				},
			},
		);

		await scheduler.run(
			[
				{
					config: fakeProject("api"),
					taskClient: {} as never,
				},
			],
			fakePolling({ enabled: true, intervalMs: 25 }),
		);

		expect(events).toEqual([
			"cycle:api:1",
			"sleep:25",
			"cycle:api:2",
			"stopped:0",
		]);
	});
});

function fakeConfig(projects: ResolvedProjectConfig[]): LoadedConfig {
	return {
		projects,
		server: { database: { databasePath: "/tmp/devos.sqlite", port: 0 } },
		polling: {
			intervalMs: 1,
			exitWhenIdle: true,
			staleRunTimeoutMs: 1,
		},
		notifications: { email: { enabled: false, to: [] } },
		workspace: { id: "workspace", name: "Workspace" },
	};
}

function fakePolling(
	overrides: Partial<PollingSettings> = {},
): PollingSettings {
	return {
		enabled: false,
		intervalMs: 1,
		exitWhenIdle: true,
		staleRunTimeoutMs: 1,
		...overrides,
	};
}

function fakeProject(id: string): ResolvedProjectConfig {
	return {
		id,
		name: id,
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
