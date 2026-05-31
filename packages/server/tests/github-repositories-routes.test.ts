import { describe, expect, it } from "bun:test";
import { handleGitHubRepositoriesRoute } from "../src/http/github-repositories-routes";
import type { GitHubRepositoryCommandRunner } from "../src/http/types/github-repositories-api.types";

describe("GitHub repositories route", () => {
	it("lists repositories with structured GitHub CLI arguments", async () => {
		const calls: Array<{ command: string; args: string[]; cwd: string }> = [];
		const runCommand: GitHubRepositoryCommandRunner = async (
			command,
			args,
			options,
		) => {
			calls.push({ command, args, cwd: options.cwd });
			return {
				code: 0,
				stderr: "",
				stdout: JSON.stringify([
					{
						nameWithOwner: "octo/core",
						defaultBranchRef: { name: "main" },
						isPrivate: false,
					},
				]),
			};
		};

		const response = await handleGitHubRepositoriesRoute(
			new Request("http://localhost/api/github/repositories"),
			"/api/github/repositories",
			"/workspace",
			runCommand,
		);

		expect(response?.status).toBe(200);
		expect(calls).toEqual([
			{
				command: "gh",
				args: [
					"repo",
					"list",
					"--limit",
					"100",
					"--json",
					"nameWithOwner,defaultBranchRef,isPrivate",
				],
				cwd: "/workspace",
			},
		]);
		expect(await response?.json()).toEqual({
			isAvailable: true,
			unavailableReason: null,
			repositories: [
				{
					id: "octo/core",
					owner: "octo",
					name: "core",
					nameWithOwner: "octo/core",
					defaultBranch: "main",
					isPrivate: false,
				},
			],
		});
	});

	it("returns an unavailable response when GitHub discovery fails", async () => {
		const runCommand: GitHubRepositoryCommandRunner = async () => ({
			code: 1,
			stdout: "",
			stderr: "authentication required",
		});

		const response = await handleGitHubRepositoriesRoute(
			new Request("http://localhost/api/github/repositories"),
			"/api/github/repositories",
			"/workspace",
			runCommand,
		);

		expect(response?.status).toBe(200);
		expect(await response?.json()).toEqual({
			isAvailable: false,
			unavailableReason: "GitHub repositories unavailable",
			repositories: [],
		});
	});
});
