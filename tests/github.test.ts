import { describe, expect, it, mock } from "bun:test";
import type { ResolvedProjectConfig } from "../src/core/types";
import {
	buildBugIssueBody,
	commentOnPr,
	createDraftPrFromWorktree,
	ensureBaseBranchFresh,
	ensureGhAuth,
	findOpenPullRequestForIssue,
	issueBranchName,
	squashMergePullRequest,
} from "../src/services/github";
import type { CommandResult } from "../src/utils/shell";

describe("buildBugIssueBody", () => {
	it("includes linear and optional pr links", () => {
		const body = buildBugIssueBody(
			"Failing test",
			"Stack trace here",
			"https://linear.app/acme/issue/ENG-1",
			"https://github.com/acme/repo/pull/10",
		);
		expect(body).toContain("Linear: https://linear.app/acme/issue/ENG-1");
		expect(body).toContain("PR: https://github.com/acme/repo/pull/10");
		expect(body).toContain("Stack trace here");
	});

	it("builds deterministic issue branch names", () => {
		expect(issueBranchName("ENG-42")).toBe("codex/eng-42");
	});
});

describe("ensureGhAuth", () => {
	it("retries and succeeds on the third attempt", async () => {
		let attempts = 0;
		const runCommand = mock(async (): Promise<CommandResult> => {
			attempts += 1;
			if (attempts < 3) {
				return { code: 1, stdout: "", stderr: "temporary failure" };
			}
			return { code: 0, stdout: "ok", stderr: "" };
		});

		await ensureGhAuth(createProjectConfig(), {
			runCommand,
			assertCommandOk: assertOk,
		});

		expect(attempts).toBe(3);
	});

	it("fails after three attempts", async () => {
		let attempts = 0;
		const runCommand = mock(async (): Promise<CommandResult> => {
			attempts += 1;
			return { code: 1, stdout: "", stderr: "still failing" };
		});

		await expect(
			ensureGhAuth(createProjectConfig(), {
				runCommand,
				assertCommandOk: assertOk,
			}),
		).rejects.toThrow("gh auth status failed after 3 attempts");
		expect(attempts).toBe(3);
	});
});

describe("ensureBaseBranchFresh", () => {
	it("fetches without writing FETCH_HEAD and fast-forwards checked-out base branch", async () => {
		const calls: string[][] = [];
		const runCommand = mock(
			async (_command: string, args: string[]): Promise<CommandResult> => {
				calls.push(args);
				if (args[0] === "branch") {
					return { code: 0, stdout: "main\n", stderr: "" };
				}
				return { code: 0, stdout: "", stderr: "" };
			},
		);

		await ensureBaseBranchFresh(createProjectConfig(), {
			runCommand,
			assertCommandOk: assertOk,
		});

		expect(calls).toEqual([
			["fetch", "--no-write-fetch-head", "origin", "main"],
			["branch", "--show-current"],
			["merge", "--ff-only", "origin/main"],
		]);
	});

	it("fast-forwards local base branch by ref when working on another branch", async () => {
		const calls: string[][] = [];
		const runCommand = mock(
			async (_command: string, args: string[]): Promise<CommandResult> => {
				calls.push(args);
				if (args[0] === "branch") {
					return { code: 0, stdout: "codex/eng-42\n", stderr: "" };
				}
				return { code: 0, stdout: "", stderr: "" };
			},
		);

		await ensureBaseBranchFresh(createProjectConfig(), {
			runCommand,
			assertCommandOk: assertOk,
		});

		expect(calls).toEqual([
			["fetch", "--no-write-fetch-head", "origin", "main"],
			["branch", "--show-current"],
			["show-ref", "--verify", "--quiet", "refs/heads/main"],
			["merge-base", "--is-ancestor", "main", "origin/main"],
			["update-ref", "refs/heads/main", "origin/main"],
		]);
	});
});

describe("commentOnPr", () => {
	it("retries transient gh pr comment failures", async () => {
		let attempts = 0;
		const runCommand = mock(
			async (_command: string, args: string[]): Promise<CommandResult> => {
				attempts += 1;
				expect(args).toEqual([
					"pr",
					"comment",
					"https://github.com/acme/repo/pull/77",
					"--body",
					"Review passed.",
				]);
				if (attempts < 3) {
					return {
						code: 1,
						stdout: "",
						stderr: 'Post "https://api.github.com/graphql": EOF',
					};
				}
				return { code: 0, stdout: "", stderr: "" };
			},
		);

		await commentOnPr(
			createProjectConfig(),
			{
				url: "https://github.com/acme/repo/pull/77",
				branch: "codex/eng-42",
				title: "Review passed",
			},
			"Review passed.",
			{ runCommand, assertCommandOk: assertOk },
		);

		expect(attempts).toBe(3);
	});

	it("reports the retry label when gh pr comment keeps failing", async () => {
		let attempts = 0;
		const runCommand = mock(async (): Promise<CommandResult> => {
			attempts += 1;
			return {
				code: 1,
				stdout: "",
				stderr: 'Post "https://api.github.com/graphql": EOF',
			};
		});

		await expect(
			commentOnPr(
				createProjectConfig(),
				{ number: 77, branch: "codex/eng-42", title: "Review passed" },
				"Review passed.",
				{
					runCommand,
					assertCommandOk: assertOk,
				},
			),
		).rejects.toThrow("gh pr comment failed after 3 attempts");
		expect(attempts).toBe(3);
	});
});

describe("squashMergePullRequest", () => {
	it("squash-merges a pull request through gh", async () => {
		const calls: string[][] = [];
		const runCommand = mock(
			async (_command: string, args: string[]): Promise<CommandResult> => {
				calls.push(args);
				return { code: 0, stdout: "", stderr: "" };
			},
		);

		const merged = await squashMergePullRequest(
			createProjectConfig(),
			{
				url: "https://github.com/acme/repo/pull/77",
				branch: "codex/eng-42",
				title: "ENG-42",
			},
			"Merged by ADHD.ai.",
			{
				runCommand,
				assertCommandOk: assertOk,
				ensureGhAuth: async () => {},
			},
		);

		expect(merged).toBe(true);
		expect(calls).toEqual([
			[
				"pr",
				"merge",
				"https://github.com/acme/repo/pull/77",
				"--squash",
				"--delete-branch",
				"--subject",
				"ENG-42",
				"--body",
				"Merged by ADHD.ai.",
			],
		]);
	});

	it("returns false without calling gh when dry run is enabled", async () => {
		const runCommand = mock(async (): Promise<CommandResult> => {
			return { code: 0, stdout: "", stderr: "" };
		});
		const config = createProjectConfig();
		config.dryRun = true;

		const merged = await squashMergePullRequest(
			config,
			{
				number: 77,
				branch: "codex/eng-42",
				title: "ENG-42",
			},
			undefined,
			{
				runCommand,
				assertCommandOk: assertOk,
				ensureGhAuth: async () => {},
			},
		);

		expect(merged).toBe(false);
		expect(runCommand).not.toHaveBeenCalled();
	});
});

describe("createDraftPrFromWorktree", () => {
	it("retries draft pr creation and returns parsed pr ref", async () => {
		let prCreateAttempts = 0;
		const runCommand = mock(
			async (_command: string, args: string[]): Promise<CommandResult> => {
				if (args[0] === "rev-parse") {
					return { code: 0, stdout: "true\n", stderr: "" };
				}
				if (args[0] === "branch" && args[1] === "--show-current") {
					return { code: 0, stdout: "codex/eng-42\n", stderr: "" };
				}
				if (args[0] === "add") {
					return { code: 0, stdout: "", stderr: "" };
				}
				if (args[0] === "diff") {
					return { code: 1, stdout: "", stderr: "" };
				}
				if (args[0] === "commit" || args[0] === "push") {
					return { code: 0, stdout: "", stderr: "" };
				}
				if (args[0] === "auth") {
					return { code: 0, stdout: "", stderr: "" };
				}
				if (args[0] === "pr" && args[1] === "create") {
					prCreateAttempts += 1;
					if (prCreateAttempts < 3) {
						return { code: 1, stdout: "", stderr: "temporary outage" };
					}
					return {
						code: 0,
						stdout: "https://github.com/acme/repo/pull/77\n",
						stderr: "",
					};
				}
				return { code: 0, stdout: "", stderr: "" };
			},
		);

		const pr = await createDraftPrFromWorktree(
			createProjectConfig(),
			"ENG-42",
			"Retry draft PR",
			{
				runCommand,
				assertCommandOk: assertOk,
			},
		);

		expect(prCreateAttempts).toBe(3);
		expect(pr.url).toBe("https://github.com/acme/repo/pull/77");
		expect(pr.number).toBe(77);
	});

	it("retries commit once after a transient failure", async () => {
		let commitAttempts = 0;
		const runCommand = mock(
			async (_command: string, args: string[]): Promise<CommandResult> => {
				if (args[0] === "rev-parse") {
					return { code: 0, stdout: "true\n", stderr: "" };
				}
				if (args[0] === "branch" && args[1] === "--show-current") {
					return { code: 0, stdout: "codex/eng-42\n", stderr: "" };
				}
				if (args[0] === "add") {
					return { code: 0, stdout: "", stderr: "" };
				}
				if (args[0] === "diff") {
					return { code: 1, stdout: "", stderr: "" };
				}
				if (args[0] === "commit") {
					commitAttempts += 1;
					if (commitAttempts === 1) {
						return { code: 1, stdout: "", stderr: "transient failure" };
					}
					return { code: 0, stdout: "", stderr: "" };
				}
				if (args[0] === "push" || args[0] === "auth") {
					return { code: 0, stdout: "", stderr: "" };
				}
				if (args[0] === "pr" && args[1] === "create") {
					return {
						code: 0,
						stdout: "https://github.com/acme/repo/pull/88\n",
						stderr: "",
					};
				}
				if (args[0] === "log") {
					return { code: 0, stdout: "not matching title\n", stderr: "" };
				}
				return { code: 0, stdout: "", stderr: "" };
			},
		);

		await createDraftPrFromWorktree(
			createProjectConfig(),
			"ENG-42",
			"Retry commit",
			{
				runCommand,
				assertCommandOk: assertOk,
			},
		);

		expect(commitAttempts).toBe(2);
	});

	it("treats ambiguous failed commit as success when already committed", async () => {
		const commitTitle = "[adhd.ai] ENG-42: Retry commit";
		let commitAttempts = 0;
		let diffCalls = 0;
		const runCommand = mock(
			async (_command: string, args: string[]): Promise<CommandResult> => {
				if (args[0] === "rev-parse") {
					return { code: 0, stdout: "true\n", stderr: "" };
				}
				if (args[0] === "branch" && args[1] === "--show-current") {
					return { code: 0, stdout: "codex/eng-42\n", stderr: "" };
				}
				if (args[0] === "add") {
					return { code: 0, stdout: "", stderr: "" };
				}
				if (args[0] === "diff") {
					diffCalls += 1;
					if (diffCalls === 1) {
						return { code: 1, stdout: "", stderr: "" };
					}
					return { code: 0, stdout: "", stderr: "" };
				}
				if (args[0] === "commit") {
					commitAttempts += 1;
					return { code: 1, stdout: "", stderr: "uncertain failure" };
				}
				if (args[0] === "log") {
					return { code: 0, stdout: `${commitTitle}\n`, stderr: "" };
				}
				if (args[0] === "push" || args[0] === "auth") {
					return { code: 0, stdout: "", stderr: "" };
				}
				if (args[0] === "pr" && args[1] === "create") {
					return {
						code: 0,
						stdout: "https://github.com/acme/repo/pull/99\n",
						stderr: "",
					};
				}
				return { code: 0, stdout: "", stderr: "" };
			},
		);

		const pr = await createDraftPrFromWorktree(
			createProjectConfig(),
			"ENG-42",
			"Retry commit",
			{
				runCommand,
				assertCommandOk: assertOk,
			},
		);

		expect(commitAttempts).toBe(1);
		expect(pr.number).toBe(99);
	});
});

describe("findOpenPullRequestForIssue", () => {
	it("returns matching open PR when list includes issue key", async () => {
		const runCommand = mock(
			async (_command: string, args: string[]): Promise<CommandResult> => {
				if (args[0] === "pr" && args[1] === "list") {
					return {
						code: 0,
						stdout: JSON.stringify([
							{
								number: 101,
								url: "https://github.com/acme/repo/pull/101",
								title: "[codex] ENG-42: Fix hourly review",
								headRefName: "codex/eng-42",
							},
						]),
						stderr: "",
					};
				}
				return { code: 0, stdout: "", stderr: "" };
			},
		);

		const pr = await findOpenPullRequestForIssue(
			createProjectConfig(),
			"ENG-42",
			{
				runCommand,
				assertCommandOk: assertOk,
			},
		);

		expect(pr).toEqual({
			number: 101,
			url: "https://github.com/acme/repo/pull/101",
			branch: "codex/eng-42",
			title: "[codex] ENG-42: Fix hourly review",
		});
	});

	it("returns undefined when no open PR is found", async () => {
		const runCommand = mock(
			async (_command: string, args: string[]): Promise<CommandResult> => {
				if (args[0] === "pr" && args[1] === "list") {
					return { code: 0, stdout: "[]", stderr: "" };
				}
				return { code: 0, stdout: "", stderr: "" };
			},
		);

		const pr = await findOpenPullRequestForIssue(
			createProjectConfig(),
			"ENG-43",
			{
				runCommand,
				assertCommandOk: assertOk,
			},
		);

		expect(pr).toBeUndefined();
	});

	it("returns undefined when only substring issue-key matches exist", async () => {
		const runCommand = mock(
			async (_command: string, args: string[]): Promise<CommandResult> => {
				if (args[0] === "pr" && args[1] === "list") {
					return {
						code: 0,
						stdout: JSON.stringify([
							{
								number: 160,
								url: "https://github.com/acme/repo/pull/160",
								title: "[codex] ROY-60: Hourly review changes",
								headRefName: "codex/roy-60",
							},
						]),
						stderr: "",
					};
				}
				return { code: 0, stdout: "", stderr: "" };
			},
		);

		const pr = await findOpenPullRequestForIssue(
			createProjectConfig(),
			"ROY-6",
			{
				runCommand,
				assertCommandOk: assertOk,
			},
		);

		expect(pr).toBeUndefined();
	});

	it("does not fall back to first result when no exact issue match exists", async () => {
		const runCommand = mock(
			async (_command: string, args: string[]): Promise<CommandResult> => {
				if (args[0] === "pr" && args[1] === "list") {
					return {
						code: 0,
						stdout: JSON.stringify([
							{
								number: 70,
								url: "https://github.com/acme/repo/pull/70",
								title: "[codex] ROY-70: Another issue",
								headRefName: "codex/roy-70",
							},
							{
								number: 80,
								url: "https://github.com/acme/repo/pull/80",
								title: "[codex] ROY-80: Different issue",
								headRefName: "codex/roy-80",
							},
						]),
						stderr: "",
					};
				}
				return { code: 0, stdout: "", stderr: "" };
			},
		);

		const pr = await findOpenPullRequestForIssue(
			createProjectConfig(),
			"ROY-6",
			{
				runCommand,
				assertCommandOk: assertOk,
			},
		);

		expect(pr).toBeUndefined();
	});
});

function assertOk(
	_command: string,
	_args: string[],
	result: CommandResult,
): void {
	if (result.code !== 0) {
		throw new Error(result.stderr || result.stdout || "command failed");
	}
}

function createProjectConfig(): ResolvedProjectConfig {
	return {
		id: "default",
		name: "Default",
		workspacePath: "/tmp/workspace",
		executionPath: "/tmp/repo",
		repo: {
			owner: "acme",
			name: "repo",
			baseBranch: "main",
		},
		linear: {
			apiKey: "key",
			apiUrl: "https://api.linear.app/graphql",
			pollLimit: 10,
			statusMap: {
				backlog: "Backlog",
				assigned: "Todo",
				planning: "Planning",
				implementing: "Implementing",
				pr_created: "PR Created",
				reviewing: "Reviewing",
				testing: "Testing",
				blocked: "Blocked",
				done: "Done",
			},
			labelMap: {},
			autoCreateLabels: true,
		},
		github: {
			useGhCli: true,
			defaultBugLabel: "bug",
		},
		codex: {
			binary: "codex",
			streamLogs: false,
		},
		skills: {
			root: "/tmp/skills",
			plan: "/tmp/plan.md",
			implement: "/tmp/implement.md",
			reviewTest: "/tmp/review.md",
		},
		dryRun: false,
	};
}
