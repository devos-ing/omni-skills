import { describe, expect, it, mock } from "bun:test";
import type {
	ResolvedNotificationConfig,
	ResolvedProjectConfig,
	RunState,
} from "../src/features/types";
import {
	safeNotifyHumanReviewRequired,
	safeNotifyTaskOutcome,
	safePrComment,
	safeSquashMergePullRequest,
	safeTaskComment,
	safeTaskMoveToCanceled,
} from "../src/features/workflow/integration-wrappers";

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
		stage: "in_review",
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
		github: { useGhCli: true, defaultBugLabel: "bug" },
		server: {
			database: {
				databasePath: "/tmp/work/.devos/config/server-db",
				port: 54329,
			},
		},
		codex: {
			binary: "codex",
			streamLogs: false,
			model: "gpt-5.4",
			reasoningEffort: "medium",
		},
		skills: {
			root: "/tmp/skills",
			brainstorm: "b",
			plan: "p",
			implement: "i",
			reviewTest: "r",
			githubComment: "g",
		},
		workflow: { issueConcurrency: 1 },
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
			safeTaskComment(
				{ comment: async () => Promise.reject(new Error("boom")) },
				"lin_1",
				"body",
			),
		).resolves.toBeUndefined();
	});

	it("swallows linear cancel errors", async () => {
		await expect(
			safeTaskMoveToCanceled(
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
				"failed",
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
