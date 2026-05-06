import { assertCommandOk, runCommand } from "./shell";
import type { BugRecord, PullRequestRef, ResolvedProjectConfig } from "./types";

export async function ensureGhAuth(
	config: ResolvedProjectConfig,
): Promise<void> {
	const result = await runCommand("gh", ["auth", "status"], {
		cwd: config.executionPath,
	});
	assertCommandOk("gh", ["auth", "status"], result);
}

export async function createDraftPrFromWorktree(
	config: ResolvedProjectConfig,
	issueKey: string,
	issueTitle: string,
): Promise<PullRequestRef> {
	await ensureGitRepository(config);

	const branch = `codex/${issueKey.toLowerCase()}`;
	await checkoutBranch(config, branch);

	const addResult = await runCommand("git", ["add", "-A"], {
		cwd: config.executionPath,
	});
	assertCommandOk("git", ["add", "-A"], addResult);

	const hasChanges = await stagedChangesExist(config);
	if (!hasChanges) {
		throw new Error(
			"No staged changes found after implement step; cannot create PR",
		);
	}

	const commitTitle = `[piv-loop] ${issueKey}: ${issueTitle}`;
	const commit = await runCommand("git", ["commit", "-m", commitTitle], {
		cwd: config.executionPath,
	});
	assertCommandOk("git", ["commit", "-m", commitTitle], commit);

	const push = await runCommand("git", ["push", "-u", "origin", branch], {
		cwd: config.executionPath,
	});
	assertCommandOk("git", ["push", "-u", "origin", branch], push);

	await ensureGhAuth(config);
	const prTitle = `[codex] ${issueKey}: ${issueTitle}`;
	const prBody = [
		`Linear issue: ${issueKey}`,
		"",
		"This PR was created by the PIV Loop workflow.",
		"",
		"Includes:",
		"- plan + implement session output",
		"- separate review/testing session",
	].join("\n");

	const create = await runCommand(
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
	assertCommandOk("gh", ["pr", "create"], create);

	const prUrl = create.stdout.trim().split("\n").filter(Boolean).at(-1);
	const prNumber = parsePrNumber(prUrl);
	return {
		number: prNumber,
		url: prUrl,
		branch,
		title: prTitle,
	};
}

export async function commentOnPr(
	config: ResolvedProjectConfig,
	pr: PullRequestRef,
	body: string,
): Promise<void> {
	if (!pr.url && !pr.number) {
		throw new Error("PR URL or number is required to leave a comment");
	}
	const target = pr.url ?? String(pr.number);
	const result = await runCommand(
		"gh",
		["pr", "comment", target, "--body", body],
		{
			cwd: config.executionPath,
		},
	);
	assertCommandOk("gh", ["pr", "comment", target], result);
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
): Promise<void> {
	const result = await runCommand(
		"git",
		["rev-parse", "--is-inside-work-tree"],
		{
			cwd: config.executionPath,
		},
	);
	assertCommandOk("git", ["rev-parse", "--is-inside-work-tree"], result);
}

async function checkoutBranch(
	config: ResolvedProjectConfig,
	branch: string,
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

	const create = await runCommand("git", ["checkout", "-b", branch], {
		cwd: config.executionPath,
	});
	assertCommandOk("git", ["checkout", "-b", branch], create);
}

async function stagedChangesExist(
	config: ResolvedProjectConfig,
): Promise<boolean> {
	const diff = await runCommand("git", ["diff", "--cached", "--quiet"], {
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
