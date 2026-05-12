import { describe, expect, it } from "bun:test";
import type { LoadedConfig } from "../src/features/config";
import type { CronJobConfig } from "../src/features/types";
import { runCronJobOnce } from "../src/integrations/cron";

describe("runCronJobOnce", () => {
	it("runs the selected job immediately", async () => {
		const jobs: CronJobConfig[] = [
			{
				id: "first",
				schedule: { frequency: "minute" },
				run: { projectId: "first-project" },
			},
			{
				id: "second",
				schedule: { frequency: "minute" },
				run: { projectId: "second-project" },
			},
		];
		const calls: string[] = [];

		await runCronJobOnce(
			createLoadedConfig(jobs),
			{ jobId: "second" },
			{
				runWorkflow: async (_config, options) => {
					calls.push(options.projectId ?? "");
				},
			},
		);

		expect(calls).toEqual(["second-project"]);
	});

	it("runs only the first enabled job when no job is specified", async () => {
		const jobs: CronJobConfig[] = [
			{
				id: "disabled",
				enabled: false,
				schedule: { frequency: "minute" },
				run: { projectId: "disabled-project" },
			},
			{
				id: "first-enabled",
				schedule: { frequency: "minute" },
				run: { projectId: "first-project" },
			},
			{
				id: "second-enabled",
				schedule: { frequency: "minute" },
				run: { projectId: "second-project" },
			},
		];
		const calls: string[] = [];

		await runCronJobOnce(
			createLoadedConfig(jobs),
			{},
			{
				runWorkflow: async (_config, options) => {
					calls.push(options.projectId ?? "");
				},
			},
		);

		expect(calls).toEqual(["first-project"]);
	});

	it("applies job skill overrides", async () => {
		const jobs: CronJobConfig[] = [
			{
				id: "skill-override",
				schedule: { frequency: "minute" },
				run: { projectId: "default" },
				skills: {
					plan: "custom/plan.md",
					implement: "/tmp/absolute-implement.md",
				},
			},
		];
		let capturedPlan = "";
		let capturedImplement = "";
		let capturedReview = "";

		await runCronJobOnce(
			createLoadedConfig(jobs),
			{},
			{
				runWorkflow: async (config) => {
					capturedPlan = config.projects[0]?.skills.plan ?? "";
					capturedImplement = config.projects[0]?.skills.implement ?? "";
					capturedReview = config.projects[0]?.skills.reviewTest ?? "";
				},
			},
		);

		expect(capturedPlan).toBe("/tmp/skills/custom/plan.md");
		expect(capturedImplement).toBe("/tmp/absolute-implement.md");
		expect(capturedReview).toBe("/tmp/skills/default-review.md");
	});

	it("reports missing and disabled jobs clearly", async () => {
		const config = createLoadedConfig([
			{
				id: "disabled",
				enabled: false,
				schedule: { frequency: "minute" },
				run: {},
			},
		]);

		await expect(runCronJobOnce(config, { jobId: "missing" })).rejects.toThrow(
			"Automation job 'missing' not found or disabled",
		);
		await expect(runCronJobOnce(config, { jobId: "disabled" })).rejects.toThrow(
			"Automation job 'disabled' not found or disabled",
		);
		await expect(runCronJobOnce(config, {})).rejects.toThrow(
			"No enabled automation jobs found",
		);
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
