import type {
	BugRecord,
	PullRequestRef,
	ResolvedProjectConfig,
} from "../core/types";
import { assertCommandOk, runCommand } from "../utils/shell";
import type { GithubCommandDeps, PrListEntry } from "./github.types";

const GITHUB_RETRY_ATTEMPTS = 3;

export function issueBranchName(issueKey: string): string {
	return `codex/${issueKey.toLowerCase()}`;
}

export async function ensureGhAuth(
	config: ResolvedProjectConfig,
	deps: GithubCommandDeps = {},
): Promise<void> {
	const commandRunner = deps.runCommand ?? runCommand;
	const assertOk = deps.assertCommandOk ?? assertCommandOk;
	await withRetries("gh auth status", async () => {
		const result = await commandRunner("gh", ["auth", "status"], {
			cwd: config.executionPath,
		});
		assertOk("gh", ["auth", "status"], result);
	});
}

export async function ensureBaseBranchFresh(
	config: ResolvedProjectConfig,
	deps: GithubCommandDeps = {},
): Promise<void> {
	const commandRunner = deps.runCommand ?? runCommand;
	const assertOk = deps.assertCommandOk ?? assertCommandOk;
	const baseBranch = config.repo.baseBranch;
	const fetch = await commandRunner(
		"git",
		["fetch", "--no-write-fetch-head", "origin", baseBranch],
		{ cwd: config.executionPath },
	);
	assertOk(
		"git",
		["fetch", "--no-write-fetch-head", "origin", baseBranch],
		fetch,
	);

	const current = await commandRunner("git", ["branch", "--show-current"], {
		cwd: config.executionPath,
	});
	assertOk("git", ["branch", "--show-current"], current);

	if (current.stdout.trim() === baseBranch) {
		const merge = await commandRunner(
			"git",
			["merge", "--ff-only", `origin/${baseBranch}`],
			{ cwd: config.executionPath },
		);
		assertOk("git", ["merge", "--ff-only", `origin/${baseBranch}`], merge);
		return;
	}

	const localBranch = await commandRunner(
		"git",
		["show-ref", "--verify", "--quiet", `refs/heads/${baseBranch}`],
		{ cwd: config.executionPath },
	);
	if (localBranch.code !== 0) {
		return;
	}

	const ancestor = await commandRunner(
		"git",
		["merge-base", "--is-ancestor", baseBranch, `origin/${baseBranch}`],
		{ cwd: config.executionPath },
	);
	assertOk(
		"git",
		["merge-base", "--is-ancestor", baseBranch, `origin/${baseBranch}`],
		ancestor,
	);
	const update = await commandRunner(
		"git",
		["update-ref", `refs/heads/${baseBranch}`, `origin/${baseBranch}`],
		{ cwd: config.executionPath },
	);
	assertOk(
		"git",
		["update-ref", `refs/heads/${baseBranch}`, `origin/${baseBranch}`],
		update,
	);
}

export async function createDraftPrFromWorktree(
	config: ResolvedProjectConfig,
	issueKey: string,
	issueTitle: string,
	deps: GithubCommandDeps = {},
): Promise<PullRequestRef> {
	const commandRunner = deps.runCommand ?? runCommand;
	const assertOk = deps.assertCommandOk ?? assertCommandOk;
	await ensureGitRepository(config, {
		runCommand: commandRunner,
		assertCommandOk: assertOk,
	});
	const branch = issueBranchName(issueKey);
	await ensureCurrentBranch(config, branch, {
		runCommand: commandRunner,
		assertCommandOk: assertOk,
	});

	await stageAllChanges(config, {
		runCommand: commandRunner,
		assertCommandOk: assertOk,
	});

	const hasChanges = await stagedChangesExist(config, {
		runCommand: commandRunner,
	});
	if (!hasChanges) {
		throw new Error(
			"No staged changes found after implement step; cannot create PR",
		);
	}

	const commitTitle = `[adhd.ai] ${issueKey}: ${issueTitle}`;
	await commitChanges(config, commitTitle, {
		runCommand: commandRunner,
		assertCommandOk: assertOk,
	});
	await pushBranch(config, branch, {
		runCommand: commandRunner,
		assertCommandOk: assertOk,
	});

	await ensureGhAuth(config, {
		runCommand: commandRunner,
		assertCommandOk: assertOk,
	});
	const prTitle = `[codex] ${issueKey}: ${issueTitle}`;
	const prBody = [
		`Linear issue: ${issueKey}`,
		"",
		"This PR was created by the Agent-Driven Development Hub (ADHD.ai) workflow.",
		"",
		"Includes:",
		"- plan + implement session output",
		"- separate review/testing session",
	].join("\n");

	const create = await withRetries("gh pr create", async () => {
		const result = await commandRunner(
			"gh",
			[
				"pr",
				"create",
				"--draft",
				"--title",
				prTitle,
				"--body",
				prBody,
				"--base",
				config.repo.baseBranch,
				"--head",
				branch,
			],
			{ cwd: config.executionPath },
		);
		assertOk("gh", ["pr", "create"], result);
		return result;
	});

	const prUrl = create.stdout.trim().split("\n").filter(Boolean).at(-1);
	const prNumber = parsePrNumber(prUrl);
	return {
		number: prNumber,
		url: prUrl,
		branch,
		title: prTitle,
	};
}

export async function updateDraftPrFromWorktree(
	config: ResolvedProjectConfig,
	prBranch: string,
	issueKey: string,
	deps: GithubCommandDeps = {},
): Promise<boolean> {
	const commandRunner = deps.runCommand ?? runCommand;
	const assertOk = deps.assertCommandOk ?? assertCommandOk;
	await ensureGitRepository(config, {
		runCommand: commandRunner,
		assertCommandOk: assertOk,
	});
	await ensureCurrentBranch(config, prBranch, {
		runCommand: commandRunner,
		assertCommandOk: assertOk,
	});
	await stageAllChanges(config, {
		runCommand: commandRunner,
		assertCommandOk: assertOk,
	});

	const hasChanges = await stagedChangesExist(config, {
		runCommand: commandRunner,
	});
	if (!hasChanges) {
		return false;
	}

	const commitTitle = `[adhd.ai] ${issueKey}: address review feedback`;
	await commitChanges(config, commitTitle, {
		runCommand: commandRunner,
		assertCommandOk: assertOk,
	});
	await pushBranch(config, prBranch, {
		runCommand: commandRunner,
		assertCommandOk: assertOk,
	});
	return true;
}

export async function prepareImplementationBranch(
	config: ResolvedProjectConfig,
	issueKey: string,
	pullRequest: PullRequestRef | undefined,
): Promise<string> {
	await ensureGitRepository(config);
	await ensureCleanWorktree(config);

	if (pullRequest?.branch) {
		await checkoutBranch(config, pullRequest.branch);
		return pullRequest.branch;
	}

	await checkoutBranch(config, config.repo.baseBranch);
	const branch = issueBranchName(issueKey);
	await checkoutBranch(config, branch, { create: true });
	return branch;
}

export async function ensureCleanWorktree(
	config: ResolvedProjectConfig,
): Promise<void> {
	const status = await runCommand("git", ["status", "--porcelain"], {
		cwd: config.executionPath,
	});
	assertCommandOk("git", ["status", "--porcelain"], status);
	if (status.stdout.trim()) {
		throw new Error(
			"Working tree is not clean before implementation. Commit/stash existing changes before running ADHD.ai.",
		);
	}
}

async function stageAllChanges(
	config: ResolvedProjectConfig,
	deps: GithubCommandDeps = {},
): Promise<void> {
	const commandRunner = deps.runCommand ?? runCommand;
	const assertOk = deps.assertCommandOk ?? assertCommandOk;
	const addResult = await commandRunner("git", ["add", "-A"], {
		cwd: config.executionPath,
	});
	assertOk("git", ["add", "-A"], addResult);
}

async function commitChanges(
	config: ResolvedProjectConfig,
	commitTitle: string,
	deps: GithubCommandDeps = {},
): Promise<void> {
	const commandRunner = deps.runCommand ?? runCommand;
	const assertOk = deps.assertCommandOk ?? assertCommandOk;
	await withRetries("git commit", async () => {
		const commit = await commandRunner("git", ["commit", "-m", commitTitle], {
			cwd: config.executionPath,
		});
		if (commit.code === 0) {
			return;
		}

		const committed = await wasCommitApplied(config, commitTitle, {
			runCommand: commandRunner,
			assertCommandOk: assertOk,
		});
		if (committed) {
			return;
		}

		assertOk("git", ["commit", "-m", commitTitle], commit);
	});
}

async function pushBranch(
	config: ResolvedProjectConfig,
	branch: string,
	deps: GithubCommandDeps = {},
): Promise<void> {
	const commandRunner = deps.runCommand ?? runCommand;
	const assertOk = deps.assertCommandOk ?? assertCommandOk;
	await withRetries("git push", async () => {
		const push = await commandRunner("git", ["push", "-u", "origin", branch], {
			cwd: config.executionPath,
		});
		assertOk("git", ["push", "-u", "origin", branch], push);
	});
}

export async function commentOnPr(
	config: ResolvedProjectConfig,
	pr: PullRequestRef,
	body: string,
	deps: GithubCommandDeps = {},
): Promise<void> {
	if (!pr.url && !pr.number) {
		throw new Error("PR URL or number is required to leave a comment");
	}
	const commandRunner = deps.runCommand ?? runCommand;
	const assertOk = deps.assertCommandOk ?? assertCommandOk;
	const target = pr.url ?? String(pr.number);
	await withRetries("gh pr comment", async () => {
		const result = await commandRunner(
			"gh",
			["pr", "comment", target, "--body", body],
			{
				cwd: config.executionPath,
			},
		);
		assertOk("gh", ["pr", "comment", target], result);
	});
}

export async function markPrReadyForReview(
	config: ResolvedProjectConfig,
	pr: PullRequestRef,
	deps?: {
		runCommand?: typeof runCommand;
		assertCommandOk?: typeof assertCommandOk;
		ensureGhAuth?: typeof ensureGhAuth;
	},
): Promise<boolean> {
	const commandRunner = deps?.runCommand ?? runCommand;
	const assertOk = deps?.assertCommandOk ?? assertCommandOk;
	const ensureAuth = deps?.ensureGhAuth ?? ensureGhAuth;

	if (config.dryRun) {
		return false;
	}
	if (!pr.url && !pr.number) {
		throw new Error("PR URL or number is required to mark PR as ready");
	}
	const target = pr.url ?? String(pr.number);

	await ensureAuth(config);
	const view = await commandRunner(
		"gh",
		["pr", "view", target, "--json", "isDraft", "--jq", ".isDraft"],
		{
			cwd: config.executionPath,
		},
	);
	assertOk("gh", ["pr", "view", target], view);

	if (view.stdout.trim().toLowerCase() !== "true") {
		return false;
	}

	const ready = await commandRunner("gh", ["pr", "ready", target], {
		cwd: config.executionPath,
	});
	assertOk("gh", ["pr", "ready", target], ready);
	return true;
}

export async function squashMergePullRequest(
	config: ResolvedProjectConfig,
	pr: PullRequestRef,
	body = "ADHD.ai review/testing passed; squash merging this PR.",
	deps?: {
		runCommand?: typeof runCommand;
		assertCommandOk?: typeof assertCommandOk;
		ensureGhAuth?: typeof ensureGhAuth;
	},
): Promise<boolean> {
	const commandRunner = deps?.runCommand ?? runCommand;
	const assertOk = deps?.assertCommandOk ?? assertCommandOk;
	const ensureAuth = deps?.ensureGhAuth ?? ensureGhAuth;

	if (config.dryRun) {
		return false;
	}
	if (!pr.url && !pr.number) {
		throw new Error("PR URL or number is required to merge PR");
	}
	const target = pr.url ?? String(pr.number);

	await ensureAuth(config);
	await withRetries("gh pr merge --squash", async () => {
		const result = await commandRunner(
			"gh",
			[
				"pr",
				"merge",
				target,
				"--squash",
				"--delete-branch",
				"--subject",
				pr.title,
				"--body",
				body,
			],
			{
				cwd: config.executionPath,
			},
		);
		assertOk("gh", ["pr", "merge", target, "--squash"], result);
	});
	return true;
}

export async function findOpenPullRequestForIssue(
	config: ResolvedProjectConfig,
	issueKey: string,
	deps: GithubCommandDeps = {},
): Promise<PullRequestRef | undefined> {
	const commandRunner = deps.runCommand ?? runCommand;
	const assertOk = deps.assertCommandOk ?? assertCommandOk;
	const search = `${issueKey} in:title`;
	const list = await withRetries("gh pr list", async () => {
		const result = await commandRunner(
			"gh",
			[
				"pr",
				"list",
				"--state",
				"open",
				"--search",
				search,
				"--limit",
				"20",
				"--json",
				"number,url,title,headRefName",
			],
			{
				cwd: config.executionPath,
			},
		);
		assertOk("gh", ["pr", "list"], result);
		return result;
	});
	const parsed = parsePrListJson(list.stdout);
	if (parsed.length === 0) {
		return undefined;
	}
	const key = issueKey.trim().toLowerCase();
	const matched = parsed.find((entry) =>
		isMatchingIssuePullRequest(entry, key, issueBranchName(issueKey)),
	);
	if (!matched) {
		return undefined;
	}
	if (!matched?.url) {
		return undefined;
	}
	return {
		number: matched.number,
		url: matched.url,
		branch: matched.headRefName || issueBranchName(issueKey),
		title: matched.title || `[codex] ${issueKey}`,
	};
}

export function buildBugIssueBody(
	bugTitle: string,
	bugBody: string,
	linearIssueUrl: string,
	prUrl?: string,
): string {
	const lines = [
		"Source workflow reported a bug.",
		"",
		`Linear: ${linearIssueUrl}`,
	];
	if (prUrl) {
		lines.push(`PR: ${prUrl}`);
	}
	lines.push("", "Details:", bugBody.trim());
	return lines.join("\n");
}

export async function createBugIssue(
	config: ResolvedProjectConfig,
	bugTitle: string,
	bugBody: string,
	linearIssueUrl: string,
	prUrl?: string,
): Promise<string | undefined> {
	await ensureGhAuth(config);
	const body = buildBugIssueBody(bugTitle, bugBody, linearIssueUrl, prUrl);
	const result = await runCommand(
		"gh",
		[
			"issue",
			"create",
			"--title",
			bugTitle,
			"--body",
			body,
			"--label",
			config.github.defaultBugLabel,
		],
		{ cwd: config.executionPath },
	);
	assertCommandOk("gh", ["issue", "create"], result);
	return result.stdout.trim().split("\n").filter(Boolean).at(-1);
}

export async function createBugIssues(
	config: ResolvedProjectConfig,
	bugs: BugRecord[],
	linearIssueUrl: string,
	prUrl?: string,
): Promise<BugRecord[]> {
	const created: BugRecord[] = [];
	for (const bug of bugs) {
		const issueUrl = await createBugIssue(
			config,
			bug.title,
			bug.body,
			linearIssueUrl,
			prUrl,
		);
		created.push({ ...bug, issueUrl });
	}
	return created;
}

async function ensureGitRepository(
	config: ResolvedProjectConfig,
	deps: GithubCommandDeps = {},
): Promise<void> {
	const commandRunner = deps.runCommand ?? runCommand;
	const assertOk = deps.assertCommandOk ?? assertCommandOk;
	const result = await commandRunner(
		"git",
		["rev-parse", "--is-inside-work-tree"],
		{
			cwd: config.executionPath,
		},
	);
	assertOk("git", ["rev-parse", "--is-inside-work-tree"], result);
}

async function checkoutBranch(
	config: ResolvedProjectConfig,
	branch: string,
	options: { create?: boolean } = {},
): Promise<void> {
	const existing = await runCommand("git", ["branch", "--list", branch], {
		cwd: config.executionPath,
	});
	assertCommandOk("git", ["branch", "--list", branch], existing);

	if (existing.stdout.trim()) {
		const checkout = await runCommand("git", ["checkout", branch], {
			cwd: config.executionPath,
		});
		assertCommandOk("git", ["checkout", branch], checkout);
		return;
	}

	if (!options.create) {
		throw new Error(`Git branch '${branch}' does not exist`);
	}

	const create = await runCommand("git", ["checkout", "-b", branch], {
		cwd: config.executionPath,
	});
	assertCommandOk("git", ["checkout", "-b", branch], create);
}

async function ensureCurrentBranch(
	config: ResolvedProjectConfig,
	branch: string,
	deps: GithubCommandDeps = {},
): Promise<void> {
	const commandRunner = deps.runCommand ?? runCommand;
	const assertOk = deps.assertCommandOk ?? assertCommandOk;
	const current = await commandRunner("git", ["branch", "--show-current"], {
		cwd: config.executionPath,
	});
	assertOk("git", ["branch", "--show-current"], current);
	if (current.stdout.trim() !== branch) {
		throw new Error(
			`Expected current branch '${branch}' before staging PR changes.`,
		);
	}
}

async function stagedChangesExist(
	config: ResolvedProjectConfig,
	deps: GithubCommandDeps = {},
): Promise<boolean> {
	const commandRunner = deps.runCommand ?? runCommand;
	const diff = await commandRunner("git", ["diff", "--cached", "--quiet"], {
		cwd: config.executionPath,
	});
	if (diff.code === 0) {
		return false;
	}
	if (diff.code === 1) {
		return true;
	}
	throw new Error(diff.stderr || "git diff --cached --quiet failed");
}

function parsePrNumber(prUrl: string | undefined): number | undefined {
	if (!prUrl) {
		return undefined;
	}
	const match = prUrl.match(/\/pull\/(\d+)/);
	return match ? Number(match[1]) : undefined;
}

function parsePrListJson(raw: string): PrListEntry[] {
	const trimmed = raw.trim();
	if (!trimmed) {
		return [];
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(trimmed);
	} catch (error) {
		throw new Error(
			`gh pr list returned invalid JSON: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}
	if (!Array.isArray(parsed)) {
		return [];
	}
	return parsed.map((entry) => {
		const record = typeof entry === "object" && entry ? entry : {};
		const row = record as Record<string, unknown>;
		return {
			number:
				typeof row.number === "number" && Number.isFinite(row.number)
					? row.number
					: undefined,
			url: typeof row.url === "string" ? row.url : undefined,
			title: typeof row.title === "string" ? row.title : undefined,
			headRefName:
				typeof row.headRefName === "string" ? row.headRefName : undefined,
		};
	});
}

function isMatchingIssuePullRequest(
	entry: PrListEntry,
	normalizedIssueKey: string,
	defaultBranchName: string,
): boolean {
	const title = entry.title?.toLowerCase() ?? "";
	const branch = entry.headRefName?.toLowerCase() ?? "";
	const defaultBranch = defaultBranchName.toLowerCase();
	return (
		matchesIssueKeyToken(title, normalizedIssueKey) ||
		matchesIssueKeyToken(branch, normalizedIssueKey) ||
		branch === defaultBranch
	);
}

function matchesIssueKeyToken(
	value: string,
	normalizedIssueKey: string,
): boolean {
	if (!value || !normalizedIssueKey) {
		return false;
	}
	const escaped = escapeRegExp(normalizedIssueKey.toLowerCase());
	const pattern = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
	return pattern.test(value);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function withRetries<T>(
	label: string,
	operation: (attempt: number) => Promise<T>,
): Promise<T> {
	let lastError: unknown;
	for (let attempt = 1; attempt <= GITHUB_RETRY_ATTEMPTS; attempt += 1) {
		try {
			return await operation(attempt);
		} catch (error) {
			lastError = error;
		}
	}
	const reason =
		lastError instanceof Error ? lastError.message : String(lastError);
	throw new Error(
		`${label} failed after ${GITHUB_RETRY_ATTEMPTS} attempts: ${reason}`,
	);
}

async function wasCommitApplied(
	config: ResolvedProjectConfig,
	commitTitle: string,
	deps: GithubCommandDeps,
): Promise<boolean> {
	const commandRunner = deps.runCommand ?? runCommand;
	const assertOk = deps.assertCommandOk ?? assertCommandOk;
	const hasStagedChanges = await stagedChangesExist(config, {
		runCommand: commandRunner,
	});
	if (hasStagedChanges) {
		return false;
	}
	const head = await commandRunner("git", ["log", "-1", "--pretty=%s"], {
		cwd: config.executionPath,
	});
	assertOk("git", ["log", "-1", "--pretty=%s"], head);
	return head.stdout.trim() === commitTitle;
}
