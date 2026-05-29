import { describe, expect, it } from "bun:test";
import type { ResolvedProjectConfig, RunState } from "../src/features/types";
import { handleReviewTestingStage } from "../src/features/workflow/review/review-stage";

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
		codex: { binary: "codex", streamLogs: false },
		agent: {},
		workflow: { issueConcurrency: 1 },
		skills: {
			root: "/tmp/skills",
			brainstorm: "/tmp/skills/piv-brainstorm/SKILL.md",
			plan: "/tmp/skills/piv-plan/SKILL.md",
			implement: "/tmp/skills/piv-implement/SKILL.md",
			reviewTest: "/tmp/skills/piv-review-test/SKILL.md",
			githubComment: "/tmp/skills/piv-github-comment/SKILL.md",
		},
		dryRun: false,
	};
}

function createState(): RunState {
	const now = new Date().toISOString();
	return {
		projectId: "default",
		projectName: "Default",
		workspacePath: "/tmp/work",
		repository: { owner: "acme", name: "repo", baseBranch: "main" },
		issue: {
			id: "lin_1",
			key: "ENG-1",
			title: "Test",
			url: "https://linear.app/acme/issue/ENG-1/test",
		},
		stage: "in_review",
		pullRequest: {
			branch: "codex/eng-1",
			title: "[codex] ENG-1: Test",
			url: "https://github.com/acme/repo/pull/10",
		},
		bugs: [],
		startedAt: now,
		updatedAt: now,
	};
}

describe("handleReviewTestingStage", () => {
	it("uses github-comment agent output for PR comments", async () => {
		const config = createConfig();
		const state = createState();
		const prComments: string[] = [];
		const runRoles: string[] = [];

		const agent = {
			runPlan: async () => ({ finalMessage: "", stdout: "" }),
			runTaskIntake: async () => ({ finalMessage: "", stdout: "" }),
			resume: async () => ({ finalMessage: "", stdout: "" }),
			runReview: async () => ({
				finalMessage: "RESULT: PASS\nSUMMARY: Looks good.\nBUGS_JSON:\n[]",
				stdout: "",
				sessionId: "review-session",
				usage: { totalTokens: 100 },
			}),
			runGithubComment: async () => ({
				finalMessage: "Custom PR comment body",
				stdout: "",
				usage: { totalTokens: 10 },
			}),
		};

		await handleReviewTestingStage(
			config,
			agent,
			{
				markStage: async () => {},
				applyStageLabel: async () => {},
				clearWorkflowStageLabels: async () => {},
				comment: async () => {},
			},
			state,
			{
				runAgentWithChatLog: async (input) => {
					runRoles.push(input.agentRole);
					return input.invoke();
				},
				appendCodexUsage: () => {},
				transitionStage: (current, to) => ({ ...current, stage: to }),
				saveRunState: async () => {},
				safePrComment: async (_cfg, _state, body) => {
					prComments.push(body);
				},
				readyPullRequestAfterPassingReview: async () => false,
				loggerInfo: () => {},
				buildIssueJobLogFields: () => ({}),
			},
		);

		expect(runRoles).toEqual(["review-testing", "github-comment"]);
		expect(prComments).toEqual(["Custom PR comment body"]);
	});

	it("falls back to default review comment if github-comment generation fails", async () => {
		const config = createConfig();
		const state = createState();
		const prComments: string[] = [];

		const agent = {
			runPlan: async () => ({ finalMessage: "", stdout: "" }),
			runTaskIntake: async () => ({ finalMessage: "", stdout: "" }),
			resume: async () => ({ finalMessage: "", stdout: "" }),
			runReview: async () => ({
				finalMessage: "RESULT: PASS\nSUMMARY: Looks good.\nBUGS_JSON:\n[]",
				stdout: "",
				sessionId: "review-session",
			}),
			runGithubComment: async () => {
				throw new Error("comment generation failed");
			},
		};

		await handleReviewTestingStage(
			config,
			agent,
			{
				markStage: async () => {},
				applyStageLabel: async () => {},
				clearWorkflowStageLabels: async () => {},
				comment: async () => {},
			},
			state,
			{
				runAgentWithChatLog: async (input) => input.invoke(),
				appendCodexUsage: () => {},
				transitionStage: (current, to) => ({ ...current, stage: to }),
				saveRunState: async () => {},
				safePrComment: async (_cfg, _state, body) => {
					prComments.push(body);
				},
				readyPullRequestAfterPassingReview: async () => false,
				loggerInfo: () => {},
				buildIssueJobLogFields: () => ({}),
			},
		);

		expect(prComments[0]).toContain("devos.ing review for ENG-1");
	});

	it("posts implementation feedback to Linear and PR when review fails", async () => {
		const config = createConfig();
		const state = { ...createState(), codexSessionId: "implement-session" };
		const linearComments: string[] = [];
		const prComments: string[] = [];

		const agent = {
			runPlan: async () => ({ finalMessage: "", stdout: "" }),
			runTaskIntake: async () => ({ finalMessage: "", stdout: "" }),
			resume: async () => ({ finalMessage: "", stdout: "" }),
			runReview: async () => ({
				finalMessage:
					'RESULT: FAIL\nSUMMARY: Tests failed.\nBUGS_JSON:\n[{"title":"Broken retry","body":"The retry test is failing."}]',
				stdout: "",
				sessionId: "review-session",
			}),
			runGithubComment: async () => ({
				finalMessage: "Generated review failure comment",
				stdout: "",
			}),
		};

		await handleReviewTestingStage(
			config,
			agent,
			{
				markStage: async () => {},
				applyStageLabel: async () => {},
				clearWorkflowStageLabels: async () => {},
				comment: async (_issueId, body) => {
					linearComments.push(body);
				},
			},
			state,
			{
				runAgentWithChatLog: async (input) => input.invoke(),
				appendCodexUsage: () => {},
				transitionStage: (current, to) => ({ ...current, stage: to }),
				saveRunState: async () => {},
				safePrComment: async (_cfg, _state, body) => {
					prComments.push(body);
				},
				readyPullRequestAfterPassingReview: async () => false,
				loggerInfo: () => {},
				buildIssueJobLogFields: () => ({}),
			},
		);

		const feedback = "devos.ing implementation feedback for ENG-1";
		expect(linearComments.join("\n")).toContain(feedback);
		expect(linearComments.join("\n")).toContain("Broken retry");
		expect(linearComments.join("\n")).toContain("The retry test is failing.");
		expect(prComments).toContain("Generated review failure comment");
		expect(prComments.join("\n")).toContain(feedback);
	});
});
