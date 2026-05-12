import { describe, expect, it } from "bun:test";
import type { LoadedConfig } from "../src/features/config";
import type { CronJobConfig } from "../src/features/types";
import {
	computeNextCronRunAt,
	runCronSchedulerCycle,
	selectCronJobs,
} from "../src/integrations/cron";

describe("computeNextCronRunAt", () => {
	it("computes minute schedules", () => {
		const next = computeNextCronRunAt(
			{ frequency: "minute", every: 5 },
			new Date(2026, 4, 7, 10, 2, 35),
		);
		expect(next.getMinutes()).toBe(5);
		expect(next.getSeconds()).toBe(0);
	});

	it("computes hourly schedules", () => {
		const next = computeNextCronRunAt(
			{ frequency: "hourly", every: 2, minute: 15 },
			new Date(2026, 4, 7, 10, 20, 0),
		);
		expect(next.getHours()).toBe(12);
		expect(next.getMinutes()).toBe(15);
	});

	it("computes daily schedules", () => {
		const next = computeNextCronRunAt(
			{ frequency: "daily", time: "09:30" },
			new Date(2026, 4, 7, 9, 40, 0),
		);
		expect(next.getDate()).toBe(8);
		expect(next.getHours()).toBe(9);
		expect(next.getMinutes()).toBe(30);
	});

	it("computes weekly schedules", () => {
		const next = computeNextCronRunAt(
			{ frequency: "weekly", dayOfWeek: "mon", time: "08:00" },
			new Date(2026, 4, 7, 9, 0, 0),
		);
		expect(next.getDay()).toBe(1);
		expect(next.getHours()).toBe(8);
		expect(next.getMinutes()).toBe(0);
	});
});

describe("selectCronJobs", () => {
	it("filters disabled jobs", () => {
		const config = createLoadedConfig([
			{
				id: "enabled",
				schedule: { frequency: "minute" },
				enabled: true,
				run: {},
			},
			{
				id: "disabled",
				schedule: { frequency: "minute" },
				enabled: false,
				run: {},
			},
		]);

		expect(selectCronJobs(config, undefined).map((job) => job.id)).toEqual([
			"enabled",
		]);
	});

	it("selects one enabled job by id", () => {
		const config = createLoadedConfig([
			{ id: "a", schedule: { frequency: "minute" }, run: {} },
			{ id: "b", schedule: { frequency: "minute" }, run: {} },
		]);
		expect(selectCronJobs(config, "b").map((job) => job.id)).toEqual(["b"]);
	});

	it("filters disabled default maintenance job", () => {
		const config = createLoadedConfig([
			{
				id: "daily-codebase-maintenance",
				name: "Daily Codebase Maintenance",
				schedule: { frequency: "daily", time: "09:00" },
				enabled: false,
				run: {
					allProjects: true,
					poll: true,
					maxPollCycles: 1,
					exitWhenIdle: true,
				},
			},
		]);
		expect(selectCronJobs(config, undefined)).toEqual([]);
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

		await runCronSchedulerCycle(createLoadedConfig(jobs), jobs, state, {
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

		await runCronSchedulerCycle(createLoadedConfig(jobs), jobs, state, {
			now: () => now,
			runWorkflow: async () => {
				called += 1;
			},
		});

		expect(called).toBe(0);
		expect(state.nextRunAtByJobId.get("busy")).toBeGreaterThan(now.getTime());
	});

	it("applies job skill overrides relative to skills.root", async () => {
		const now = new Date(2026, 4, 7, 10, 0, 0);
		const jobs: CronJobConfig[] = [
			{
				id: "skill-override",
				schedule: { frequency: "minute", every: 1 },
				run: { projectId: "default" },
				skills: {
					plan: "custom/plan.md",
					implement: "/tmp/absolute-implement.md",
				},
			},
		];
		const state = {
			nextRunAtByJobId: new Map<string, number>([
				["skill-override", now.getTime() - 1000],
			]),
			activeJobIds: new Set<string>(),
		};
		let capturedPlan = "";
		let capturedImplement = "";
		let capturedReview = "";

		await runCronSchedulerCycle(createLoadedConfig(jobs), jobs, state, {
			now: () => now,
			runWorkflow: async (config) => {
				capturedPlan = config.projects[0]?.skills.plan ?? "";
				capturedImplement = config.projects[0]?.skills.implement ?? "";
				capturedReview = config.projects[0]?.skills.reviewTest ?? "";
			},
		});

		expect(capturedPlan).toBe("/tmp/skills/custom/plan.md");
		expect(capturedImplement).toBe("/tmp/absolute-implement.md");
		expect(capturedReview).toBe("/tmp/skills/default-review.md");
	});
});

function createLoadedConfig(jobs: CronJobConfig[]): LoadedConfig {
	return {
		projects: [
			{
				id: "default",
				name: "Default",
				workspacePath: "/tmp/ws",
				executionPath: "/tmp/ws",
				repo: { owner: "acme", name: "repo", baseBranch: "main" },
				linear: {
					apiKey: "k",
					apiUrl: "https://api.linear.app/graphql",
					pollLimit: 10,
					statusMap: {
						backlog: "Backlog",
						assigned: "Todo",
						planning: "In Progress",
						implementing: "In Progress",
						pr_created: "In Review",
						reviewing: "In Review",
						testing: "In Review",
						blocked: "Canceled",
						done: "Done",
					},
					labelMap: {},
					autoCreateLabels: true,
				},
				github: { useGhCli: true, defaultBugLabel: "bug" },
				codex: { binary: "codex", streamLogs: false },
				skills: {
					root: "/tmp/skills",
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
		polling: {
			intervalMs: 30000,
			maxCycles: undefined,
			exitWhenIdle: true,
			staleRunTimeoutMs: 3600000,
		},
		automations: { jobs },
		cron: { jobs },
		notifications: {
			email: {
				enabled: false,
				to: [],
			},
		},
	};
}
