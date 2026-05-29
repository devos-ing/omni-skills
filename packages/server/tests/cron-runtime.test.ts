import { describe, expect, it } from "bun:test";
import type { LoadedConfig } from "devos/features/config";
import {
	type CronJobConfig,
	runCronJobOnce,
	runCronSchedulerCycle,
	selectCronJobs,
} from "../src/cron";

describe("selectCronJobs", () => {
	it("filters disabled jobs and supports id selection", () => {
		const configuredJobs: CronJobConfig[] = [
			{ id: "a", schedule: { frequency: "minute" }, run: {}, enabled: true },
			{ id: "b", schedule: { frequency: "minute" }, run: {}, enabled: false },
		];

		expect(
			selectCronJobs(configuredJobs, undefined).map((job) => job.id),
		).toEqual(["a"]);
		expect(selectCronJobs(configuredJobs, "a").map((job) => job.id)).toEqual([
			"a",
		]);
	});
});

describe("runCronSchedulerCycle", () => {
	it("starts due jobs and advances next run", async () => {
		const now = new Date(2026, 4, 7, 10, 0, 0);
		const jobs: CronJobConfig[] = [
			{
				id: "due",
				schedule: { frequency: "minute", every: 5 },
				enabled: true,
				run: { projectId: "default" },
			},
		];
		const state = {
			nextRunAtByJobId: new Map<string, number>([
				["due", now.getTime() - 1000],
			]),
			activeJobIds: new Set<string>(),
		};
		let called = 0;
		let release: (() => void) | undefined;
		const running = new Promise<void>((resolve) => {
			release = resolve;
		});

		await runCronSchedulerCycle(createLoadedConfig(), jobs, state, {
			now: () => now,
			runWorkflow: async () => {
				called += 1;
				await running;
			},
		});

		expect(called).toBe(1);
		expect(state.activeJobIds.has("due")).toBe(true);
		expect(state.nextRunAtByJobId.get("due")).toBeGreaterThanOrEqual(
			now.getTime(),
		);
		release?.();
		await Promise.resolve();
	});

	it("skips overlapping due jobs", async () => {
		const now = new Date(2026, 4, 7, 10, 0, 0);
		const jobs: CronJobConfig[] = [
			{
				id: "busy",
				schedule: { frequency: "minute", every: 1 },
				enabled: true,
				run: {},
			},
		];
		const state = {
			nextRunAtByJobId: new Map<string, number>([
				["busy", now.getTime() - 60000],
			]),
			activeJobIds: new Set<string>(["busy"]),
		};
		let called = 0;

		await runCronSchedulerCycle(createLoadedConfig(), jobs, state, {
			now: () => now,
			runWorkflow: async () => {
				called += 1;
			},
		});

		expect(called).toBe(0);
		expect(state.nextRunAtByJobId.get("busy")).toBeGreaterThan(now.getTime());
	});
});

describe("runCronJobOnce", () => {
	it("runs selected job, applies skill overrides, and validates missing/disabled", async () => {
		const jobs: CronJobConfig[] = [
			{
				id: "disabled",
				enabled: false,
				schedule: { frequency: "minute" },
				run: { projectId: "disabled-project" },
			},
			{
				id: "enabled",
				schedule: { frequency: "minute" },
				run: { projectId: "enabled-project" },
				skills: {
					plan: "custom/plan.md",
					implement: "/tmp/absolute-implement.md",
				},
			},
		];
		const calls: string[] = [];
		let capturedPlan = "";
		let capturedImplement = "";
		let capturedReview = "";

		await runCronJobOnce(
			createLoadedConfig(),
			{ jobId: "enabled", jobs },
			{
				runWorkflow: async (config, options) => {
					calls.push(options.projectId ?? "");
					capturedPlan = config.projects[0]?.skills.plan ?? "";
					capturedImplement = config.projects[0]?.skills.implement ?? "";
					capturedReview = config.projects[0]?.skills.reviewTest ?? "";
				},
			},
		);

		expect(calls).toEqual(["enabled-project"]);
		expect(capturedPlan).toBe("/tmp/skills/custom/plan.md");
		expect(capturedImplement).toBe("/tmp/absolute-implement.md");
		expect(capturedReview).toBe("/tmp/skills/default-review.md");
		await expect(
			runCronJobOnce(createLoadedConfig(), { jobId: "missing", jobs }),
		).rejects.toThrow("Automation job 'missing' not found or disabled");
		await expect(
			runCronJobOnce(createLoadedConfig(), { jobId: "disabled", jobs }),
		).rejects.toThrow("Automation job 'disabled' not found or disabled");
		await expect(
			runCronJobOnce(createLoadedConfig(), { jobs: [] }),
		).rejects.toThrow("No enabled automation jobs found");
	});
});

function createLoadedConfig(): LoadedConfig {
	return {
		projects: [
			{
				id: "default",
				name: "Default",
				workspacePath: "/tmp/ws",
				executionPath: "/tmp/ws",
				repo: { owner: "acme", name: "repo", baseBranch: "main" },
				github: { useGhCli: true, defaultBugLabel: "bug" },
				server: {
					database: { databasePath: "/tmp/devos.sqlite", port: 54329 },
				},
				codex: { binary: "codex", streamLogs: false },
				skills: {
					root: "/tmp/skills",
					brainstorm: "/tmp/skills/default-brainstorm.md",
					plan: "/tmp/skills/default-plan.md",
					implement: "/tmp/skills/default-implement.md",
					reviewTest: "/tmp/skills/default-review.md",
					githubComment: "/tmp/skills/default-github-comment.md",
				},
				workflow: {
					issueConcurrency: 1,
				},
				dryRun: false,
			},
		],
		server: { database: { databasePath: "/tmp/devos.sqlite", port: 54329 } },
		polling: {
			intervalMs: 30000,
			maxCycles: undefined,
			exitWhenIdle: true,
			staleRunTimeoutMs: 3600000,
		},
		notifications: {
			email: {
				enabled: false,
				to: [],
			},
		},
		workspace: { id: "owner-1", name: "Default Workspace" },
	};
}
