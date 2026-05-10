import { describe, expect, it, mock } from "bun:test";
import {
	safeLinearComment,
	safeLinearMoveToCanceled,
	safeNotifyHumanReviewRequired,
	safeNotifyTaskOutcome,
	safePrComment,
	safeSquashMergePullRequest,
} from "../src/core/integration-wrappers";
import type {
	ResolvedNotificationConfig,
	ResolvedProjectConfig,
	RunState,
} from "../src/core/types";

function createState(): RunState {
	const now = new Date().toISOString();
	return {
		projectId: "default",
		projectName: "Default",
		workspacePath: "/tmp/work",
		repository: {
			owner: "acme",
			name: "repo",
			baseBranch: "main",
		},
		issue: {
			id: "lin_1",
			key: "ENG-1",
			title: "Test",
			url: "https://linear.app/acme/issue/ENG-1/test",
		},
		stage: "reviewing",
		bugs: [],
		pullRequest: {
			number: 7,
			url: "https://github.com/acme/repo/pull/7",
			branch: "codex/eng-1",
			title: "ENG-1",
		},
		startedAt: now,
		updatedAt: now,
	};
}

function createConfig(): ResolvedProjectConfig {
	return {
		id: "default",
		name: "Default",
		workspacePath: "/tmp/work",
		executionPath: "/tmp/work/repo",
		repo: { owner: "acme", name: "repo", baseBranch: "main" },
		linear: {
			apiKey: "x",
			apiUrl: "https://api.linear.app/graphql",
			pollLimit: 10,
			statusMap: {
				assigned: "a",
				planning: "b",
				implementing: "c",
				pr_created: "d",
				reviewing: "e",
				testing: "f",
				blocked: "g",
				done: "h",
			},
			labelMap: {
				pr_created: "PR Created",
				reviewing: "Reviewing",
				testing: "Testing",
			},
			autoCreateLabels: true,
		},
		github: { useGhCli: true, defaultBugLabel: "bug" },
		codex: {
			binary: "codex",
			streamLogs: false,
			model: "gpt-5.4",
			reasoningEffort: "medium",
		},
		skills: { root: "/tmp/skills", plan: "p", implement: "i", reviewTest: "r" },
		dryRun: false,
	};
}

function createNotifications(): ResolvedNotificationConfig {
	return {
		email: {
			enabled: true,
			resendApiKey: "x",
			from: "a@example.com",
			to: ["b@example.com"],
		},
	};
}

describe("integration wrappers", () => {
	it("swallows linear comment errors", async () => {
		await expect(
			safeLinearComment(
				{ comment: async () => Promise.reject(new Error("boom")) },
				"lin_1",
				"body",
			),
		).resolves.toBeUndefined();
	});

	it("swallows linear cancel errors", async () => {
		await expect(
			safeLinearMoveToCanceled(
				{ markCanceled: async () => Promise.reject(new Error("boom")) },
				"lin_1",
			),
		).resolves.toBeUndefined();
	});

	it("returns false when there is no pull request to merge", async () => {
		const state = { ...createState(), pullRequest: undefined };
		const merged = await safeSquashMergePullRequest(createConfig(), state);
		expect(merged).toBe(false);
	});

	it("swallows pull request comment errors", async () => {
		const commentOnPr = mock(async () => {
			throw new Error("boom");
		});
		await expect(
			safePrComment(createConfig(), createState(), "review", { commentOnPr }),
		).resolves.toBeUndefined();
		expect(commentOnPr).toHaveBeenCalledTimes(1);
	});

	it("returns false when squash merge fails", async () => {
		const squashMergePullRequest = mock(async () => {
			throw new Error("boom");
		});
		const merged = await safeSquashMergePullRequest(
			createConfig(),
			createState(),
			{ squashMergePullRequest },
		);
		expect(merged).toBe(false);
	});

	it("swallows task outcome notification errors", async () => {
		const send = mock(async () => {
			throw new Error("boom");
		});
		await expect(
			safeNotifyTaskOutcome(
				createNotifications(),
				createState(),
				"blocked",
				"error",
				{ sendTaskOutcomeEmail: send },
			),
		).resolves.toBeUndefined();
		expect(send).toHaveBeenCalledTimes(1);
	});

	it("swallows human review notification errors", async () => {
		const send = mock(async () => {
			throw new Error("boom");
		});
		await expect(
			safeNotifyHumanReviewRequired(
				createNotifications(),
				createState(),
				7,
				"complex change",
				{ sendHumanReviewRequiredEmail: send },
			),
		).resolves.toBeUndefined();
		expect(send).toHaveBeenCalledTimes(1);
	});
});
