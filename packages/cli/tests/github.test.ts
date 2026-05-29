import { describe, expect, it, mock } from "bun:test";
import type { ResolvedProjectConfig } from "../src/features/types";
import {
	buildBugIssueBody,
	commentOnPr,
	createDraftPrFromWorktree,
	ensureBaseBranchFresh,
	ensureGhAuth,
	ensureIssueWorktree,
	findOpenPullRequestForIssue,
	getPullRequestMergeStatus,
	issueBranchName,
	prepareWorktreeDependencies,
	removeIssueWorktree,
	squashMergePullRequest,
} from "../src/integrations/github";
import type { CommandResult } from "../src/utils/shell";

describe("buildBugIssueBody", () => {
	it("includes task and optional pr links", () => {
		const body = buildBugIssueBody(
			"Failing test",
			"Stack trace here",
			"https://linear.app/acme/issue/ENG-1",
			"https://github.com/acme/repo/pull/10",
		);
		expect(body).toContain("Task: https://linear.app/acme/issue/ENG-1");
		expect(body).toContain("PR: https://github.com/acme/repo/pull/10");
		expect(body).toContain("Stack trace here");
	});

	it("builds deterministic issue branch names", () => {
		expect(issueBranchName("ENG-42")).toBe("codex/eng-42");
		expect(issueBranchName("TASK(OWNER-1)-1", "OWN-1")).toBe("OWN-1");
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
	it("retries transient base branch prep failures", async () => {
		let fetchAttempts = 0;
		const runCommand = mock(
			async (_command: string, args: string[]): Promise<CommandResult> => {
				if (args[0] === "fetch") {
					fetchAttempts += 1;
					if (fetchAttempts < 3) {
						return { code: 1, stdout: "", stderr: "network unavailable" };
					}
				}
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

		expect(fetchAttempts).toBe(3);
	});

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
			"Merged by devos.ing.",
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
				"Merged by devos.ing.",
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
		const commitTitle = "[devos] ENG-42: Retry commit";
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

	it("creates draft PRs from branch name overrides", async () => {
		const calls: string[][] = [];
		const runCommand = mock(
			async (_command: string, args: string[]): Promise<CommandResult> => {
				calls.push(args);
				if (args[0] === "rev-parse") {
					return { code: 0, stdout: "true\n", stderr: "" };
				}
				if (args[0] === "branch" && args[1] === "--show-current") {
					return { code: 0, stdout: "OWN-1\n", stderr: "" };
				}
				if (args[0] === "diff") {
					return { code: 1, stdout: "", stderr: "" };
				}
				if (
					args[0] === "add" ||
					args[0] === "commit" ||
					args[0] === "push" ||
					args[0] === "auth"
				) {
					return { code: 0, stdout: "", stderr: "" };
				}
				if (args[0] === "pr" && args[1] === "create") {
					return {
						code: 0,
						stdout: "https://github.com/acme/repo/pull/100\n",
						stderr: "",
					};
				}
				return { code: 0, stdout: "", stderr: "" };
			},
		);

		const pr = await createDraftPrFromWorktree(
			createProjectConfig(),
			"TASK(OWNER-1)-1",
			"Workspace task",
			"OWN-1",
			{ runCommand, assertCommandOk: assertOk },
		);

		expect(pr.branch).toBe("OWN-1");
		expect(calls).toContainEqual(["push", "-u", "origin", "OWN-1"]);
		expect(calls).toContainEqual([
			"pr",
			"create",
			"--draft",
			"--title",
			"[codex] TASK(OWNER-1)-1: Workspace task",
			"--body",
			expect.any(String),
			"--base",
			"main",
			"--head",
			"OWN-1",
		]);
	});
});

describe("ensureIssueWorktree", () => {
	it("retries transient issue worktree creation failures", async () => {
		let addAttempts = 0;
		const runCommand = mock(
			async (_command: string, args: string[]): Promise<CommandResult> => {
				if (args[0] === "rev-parse") {
					return { code: 0, stdout: "true\n", stderr: "" };
				}
				if (args[0] === "show-ref") {
					return { code: 1, stdout: "", stderr: "" };
				}
				if (args[0] === "worktree") {
					addAttempts += 1;
					if (addAttempts < 3) {
						return { code: 1, stdout: "", stderr: "index.lock exists" };
					}
				}
				return { code: 0, stdout: "", stderr: "" };
			},
		);

		const branch = await ensureIssueWorktree(
			createProjectConfig(),
			"ENG-42",
			undefined,
			"/tmp/worktrees/eng-42",
			{ runCommand, assertCommandOk: assertOk },
		);

		expect(branch).toBe("codex/eng-42");
		expect(addAttempts).toBe(3);
	});

	it("creates a new issue worktree from the base branch", async () => {
		const calls: string[][] = [];
		const runCommand = mock(
			async (_command: string, args: string[]): Promise<CommandResult> => {
				calls.push(args);
				if (args[0] === "rev-parse") {
					return { code: 0, stdout: "true\n", stderr: "" };
				}
				if (args[0] === "show-ref") {
					return { code: 1, stdout: "", stderr: "" };
				}
				return { code: 0, stdout: "", stderr: "" };
			},
		);

		const branch = await ensureIssueWorktree(
			createProjectConfig(),
			"ENG-42",
			undefined,
			"/tmp/worktrees/eng-42",
			{ runCommand, assertCommandOk: assertOk },
		);

		expect(branch).toBe("codex/eng-42");
		expect(calls).toContainEqual([
			"worktree",
			"add",
			"-b",
			"codex/eng-42",
			"/tmp/worktrees/eng-42",
			"origin/main",
		]);
	});

	it("creates a new issue worktree with a branch name override", async () => {
		const calls: string[][] = [];
		const runCommand = mock(
			async (_command: string, args: string[]): Promise<CommandResult> => {
				calls.push(args);
				if (args[0] === "rev-parse") {
					return { code: 0, stdout: "true\n", stderr: "" };
				}
				if (args[0] === "show-ref") {
					return { code: 1, stdout: "", stderr: "" };
				}
				return { code: 0, stdout: "", stderr: "" };
			},
		);

		const branch = await ensureIssueWorktree(
			createProjectConfig(),
			"TASK(OWNER-1)-1",
			undefined,
			"/tmp/worktrees/owner-1-1",
			"OWN-1",
			{ runCommand, assertCommandOk: assertOk },
		);

		expect(branch).toBe("OWN-1");
		expect(calls).toContainEqual([
			"worktree",
			"add",
			"-b",
			"OWN-1",
			"/tmp/worktrees/owner-1-1",
			"origin/main",
		]);
	});

	it("creates an existing PR worktree from the remote PR branch", async () => {
		const calls: string[][] = [];
		const runCommand = mock(
			async (_command: string, args: string[]): Promise<CommandResult> => {
				calls.push(args);
				if (args[0] === "rev-parse") {
					return { code: 0, stdout: "true\n", stderr: "" };
				}
				if (args[0] === "show-ref") {
					return { code: 1, stdout: "", stderr: "" };
				}
				return { code: 0, stdout: "", stderr: "" };
			},
		);

		const branch = await ensureIssueWorktree(
			createProjectConfig(),
			"ENG-42",
			{
				branch: "codex/eng-42",
				title: "ENG-42",
				url: "https://github.example/pull/42",
			},
			"/tmp/worktrees/eng-42",
			{ runCommand, assertCommandOk: assertOk },
		);

		expect(branch).toBe("codex/eng-42");
		expect(calls).toContainEqual([
			"fetch",
			"origin",
			"codex/eng-42:refs/remotes/origin/codex/eng-42",
		]);
		expect(calls).toContainEqual([
			"worktree",
			"add",
			"-b",
			"codex/eng-42",
			"/tmp/worktrees/eng-42",
			"origin/codex/eng-42",
		]);
	});

	it("reuses an existing issue worktree on the expected branch", async () => {
		const calls: string[][] = [];
		const runCommand = mock(
			async (_command: string, args: string[]): Promise<CommandResult> => {
				calls.push(args);
				if (args[0] === "rev-parse") {
					return { code: 0, stdout: "true\n", stderr: "" };
				}
				if (args[0] === "branch") {
					return { code: 0, stdout: "codex/eng-42\n", stderr: "" };
				}
				return { code: 0, stdout: "", stderr: "" };
			},
		);

		const branch = await ensureIssueWorktree(
			createProjectConfig(),
			"ENG-42",
			undefined,
			"/tmp",
			{ runCommand, assertCommandOk: assertOk },
		);

		expect(branch).toBe("codex/eng-42");
		expect(calls).not.toContainEqual([
			"worktree",
			"add",
			"/tmp",
			"codex/eng-42",
		]);
	});

	it("refreshes a reused PR worktree from the remote branch", async () => {
		const calls: string[][] = [];
		const runCommand = mock(
			async (_command: string, args: string[]): Promise<CommandResult> => {
				calls.push(args);
				if (args[0] === "rev-parse") {
					return { code: 0, stdout: "true\n", stderr: "" };
				}
				if (args[0] === "branch") {
					return { code: 0, stdout: "codex/eng-42\n", stderr: "" };
				}
				return { code: 0, stdout: "", stderr: "" };
			},
		);

		const branch = await ensureIssueWorktree(
			createProjectConfig(),
			"ENG-42",
			{
				branch: "codex/eng-42",
				title: "ENG-42",
				url: "https://github.example/pull/42",
			},
			"/tmp",
			{ runCommand, assertCommandOk: assertOk },
		);

		expect(branch).toBe("codex/eng-42");
		expect(calls).toContainEqual([
			"fetch",
			"origin",
			"codex/eng-42:refs/remotes/origin/codex/eng-42",
		]);
		expect(calls).toContainEqual(["reset", "--hard", "origin/codex/eng-42"]);
	});

	it("removes an issue worktree and reports dirty retained worktrees", async () => {
		const config = createProjectConfig();
		const removed = await removeIssueWorktree(config, "/tmp/worktrees/eng-42", {
			runCommand: mock(async (): Promise<CommandResult> => {
				return { code: 0, stdout: "", stderr: "" };
			}),
		});
		const retained = await removeIssueWorktree(
			config,
			"/tmp/worktrees/eng-43",
			{
				runCommand: mock(async (): Promise<CommandResult> => {
					return { code: 1, stdout: "", stderr: "contains modified files" };
				}),
			},
		);

		expect(removed).toEqual({ removed: true });
		expect(retained).toEqual({
			removed: false,
			reason: "contains modified files",
		});
	});
});

describe("prepareWorktreeDependencies", () => {
	it("retries transient bun install failures", async () => {
		let attempts = 0;
		const runCommand = mock(async (): Promise<CommandResult> => {
			attempts += 1;
			if (attempts < 3) {
				return { code: 1, stdout: "", stderr: "temporary registry failure" };
			}
			return { code: 0, stdout: "", stderr: "" };
		});

		await prepareWorktreeDependencies("/tmp/worktrees/eng-42", {
			runCommand,
		});

		expect(attempts).toBe(3);
	});

	it("runs frozen bun install in the isolated worktree", async () => {
		const calls: Array<{ command: string; args: string[]; cwd: string }> = [];
		const runCommand = mock(
			async (
				command: string,
				args: string[],
				options: { cwd: string },
			): Promise<CommandResult> => {
				calls.push({ command, args, cwd: options.cwd });
				return { code: 0, stdout: "", stderr: "" };
			},
		);

		await prepareWorktreeDependencies("/tmp/worktrees/eng-42", {
			runCommand,
		});

		expect(calls).toEqual([
			{
				command: "bun",
				args: ["install", "--frozen-lockfile"],
				cwd: "/tmp/worktrees/eng-42",
			},
		]);
	});

	it("throws an actionable dependency setup error when install fails", async () => {
		let attempts = 0;
		const runCommand = mock(async (): Promise<CommandResult> => {
			attempts += 1;
			return {
				code: 1,
				stdout: "",
				stderr: "FailedToOpenSocket while fetching package manifests",
			};
		});

		await expect(
			prepareWorktreeDependencies("/tmp/worktrees/eng-42", {
				runCommand,
			}),
		).rejects.toThrow(
			"Ensure this environment has network access or a populated Bun dependency cache / node_modules matching bun.lock.",
		);
		expect(attempts).toBe(3);
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

	it("matches open PRs by branch name override", async () => {
		const runCommand = mock(
			async (_command: string, args: string[]): Promise<CommandResult> => {
				if (args[0] === "pr" && args[1] === "list") {
					return {
						code: 0,
						stdout: JSON.stringify([
							{
								number: 171,
								url: "https://github.com/acme/repo/pull/171",
								title: "[codex] Workspace task",
								headRefName: "OWN-1",
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
			"TASK(OWNER-1)-1",
			"OWN-1",
			{
				runCommand,
				assertCommandOk: assertOk,
			},
		);

		expect(pr).toEqual({
			number: 171,
			url: "https://github.com/acme/repo/pull/171",
			branch: "OWN-1",
			title: "[codex] Workspace task",
		});
	});
});

describe("getPullRequestMergeStatus", () => {
	it("returns merge conflict state from gh pr view", async () => {
		const runCommand = mock(
			async (_command: string, args: string[]): Promise<CommandResult> => {
				if (args[0] === "pr" && args[1] === "view") {
					return {
						code: 0,
						stdout: JSON.stringify({
							mergeStateStatus: "DIRTY",
							mergeable: "CONFLICTING",
						}),
						stderr: "",
					};
				}
				return { code: 0, stdout: "", stderr: "" };
			},
		);

		const status = await getPullRequestMergeStatus(
			createProjectConfig(),
			{
				url: "https://github.com/acme/repo/pull/42",
				branch: "codex/eng-42",
				title: "ENG-42",
			},
			{
				runCommand,
				assertCommandOk: assertOk,
			},
		);

		expect(status).toEqual({
			mergeStateStatus: "DIRTY",
			mergeable: "CONFLICTING",
		});
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
		github: {
			useGhCli: true,
			defaultBugLabel: "bug",
		},
		server: {
			database: {
				databasePath: "/tmp/workspace/.devos/config/server-db",
				port: 54329,
			},
		},
		codex: {
			binary: "codex",
			streamLogs: false,
		},
		skills: {
			root: "/tmp/skills",
			brainstorm: "/tmp/brainstorm.md",
			plan: "/tmp/plan.md",
			implement: "/tmp/implement.md",
			reviewTest: "/tmp/review.md",
			githubComment: "/tmp/github-comment.md",
		},
		workflow: {
			issueConcurrency: 1,
		},
		dryRun: false,
	};
}
