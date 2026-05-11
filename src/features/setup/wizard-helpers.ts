import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type readline from "node:readline/promises";
import type { CodexReasoningEffort } from "../../core/types";
import { runCommand } from "../../utils/shell";
import { safeRun } from "./checks-helpers";
import { DEFAULT_BASE_BRANCH } from "./constants";
import type { GitHubDefaults, SetupCheckDeps, SetupDraft } from "./setup.types";

export async function ask(
	io: readline.Interface,
	label: string,
	defaultValue: string,
): Promise<string> {
	const suffix = defaultValue ? ` [${defaultValue}]` : "";
	const answer = await io.question(`${label}${suffix}: `);
	return answer.trim() || defaultValue;
}

export async function readExistingFile(
	filePath: string,
): Promise<string | undefined> {
	try {
		return await readFile(filePath, "utf8");
	} catch {
		return undefined;
	}
}

export async function inferGitHubDefaults(
	cwd: string,
): Promise<GitHubDefaults> {
	const commandRunner = runCommand as NonNullable<SetupCheckDeps["runCommand"]>;
	const remote = await safeRun(
		commandRunner,
		"git",
		["config", "--get", "remote.origin.url"],
		cwd,
	);
	const branch = await safeRun(
		commandRunner,
		"git",
		["symbolic-ref", "refs/remotes/origin/HEAD", "--short"],
		cwd,
	);
	const parsed = parseGitHubRemote(remote.stdout.trim());
	const branchName = branch.stdout.trim().replace(/^origin\//, "");
	return { ...parsed, baseBranch: branchName || DEFAULT_BASE_BRANCH };
}

export function resolveUserPath(input: string): string {
	if (input === "~") return os.homedir();
	if (input.startsWith("~/")) return path.join(os.homedir(), input.slice(2));
	return path.resolve(input);
}

export function emptyToUndefined(input: string): string | undefined {
	const value = input.trim();
	return value ? value : undefined;
}

export function parseRecipients(input: string): string[] {
	return input
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

export function normalizeSandbox(
	input: string,
): SetupDraft["codex"]["sandbox"] | undefined {
	const value = input.trim();
	if (!value || value === "off" || value === "none" || value === "0") {
		return undefined;
	}
	if (
		value === "read-only" ||
		value === "workspace-write" ||
		value === "danger-full-access"
	) {
		return value;
	}
	return "workspace-write";
}

export function normalizeReasoningEffort(
	input: string,
	fallback: CodexReasoningEffort,
): CodexReasoningEffort {
	const value = input.trim().toLowerCase();
	if (
		value === "low" ||
		value === "medium" ||
		value === "high" ||
		value === "xhigh"
	) {
		return value;
	}
	return fallback;
}

export function parseYesNo(input: string): boolean {
	const value = input.trim().toLowerCase();
	return value === "" || value === "y" || value === "yes" || value === "true";
}

function parseGitHubRemote(
	remote: string,
): Pick<GitHubDefaults, "owner" | "name"> {
	const httpsMatch =
		/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/.exec(remote);
	if (httpsMatch) return { owner: httpsMatch[1], name: httpsMatch[2] };
	const sshMatch = /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/.exec(remote);
	if (sshMatch) return { owner: sshMatch[1], name: sshMatch[2] };
	return {};
}
