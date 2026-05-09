import { describe, expect, it, mock } from "bun:test";
import {
	type RunCommandFn,
	parseReleaseTarget,
	runPublishVersion,
} from "../scripts/publish-version";
import type { CommandResult } from "../src/utils/shell";

function ok(stdout = ""): CommandResult {
	return { code: 0, stdout, stderr: "" };
}

describe("parseReleaseTarget", () => {
	it("accepts bump keywords", () => {
		expect(parseReleaseTarget("patch")).toBe("patch");
		expect(parseReleaseTarget("minor")).toBe("minor");
		expect(parseReleaseTarget("major")).toBe("major");
	});

	it("accepts explicit semver", () => {
		expect(parseReleaseTarget("1.2.3")).toBe("1.2.3");
		expect(parseReleaseTarget("2.0.0-beta.1")).toBe("2.0.0-beta.1");
	});

	it("rejects missing argument", () => {
		expect(() => parseReleaseTarget(undefined)).toThrow(
			"Missing version argument",
		);
	});

	it("rejects invalid target", () => {
		expect(() => parseReleaseTarget("foo")).toThrow("Invalid version target");
		expect(() => parseReleaseTarget("1.2")).toThrow("Invalid version target");
	});
});

describe("runPublishVersion", () => {
	it("runs release commands in sequence", async () => {
		const calls: Array<{ command: string; args: string[] }> = [];
		const runner = mock(
			async (command: string, args: string[]): Promise<CommandResult> => {
				calls.push({ command, args });
				return ok("");
			},
		) as RunCommandFn;

		await runPublishVersion("/repo", "patch", runner);

		expect(calls).toEqual([
			{ command: "git", args: ["status", "--porcelain"] },
			{ command: "npm", args: ["version", "patch", "--no-git-tag-version"] },
			{ command: "bun", args: ["run", "check"] },
			{ command: "bun", args: ["run", "typecheck"] },
			{ command: "bun", args: ["test"] },
			{ command: "bun", args: ["run", "build"] },
			{ command: "npm", args: ["publish", "--access", "public"] },
		]);
	});

	it("fails when worktree is dirty", async () => {
		const runner = mock(async (command: string): Promise<CommandResult> => {
			if (command === "git") {
				return ok(" M package.json\n");
			}
			return ok("");
		}) as RunCommandFn;

		await expect(runPublishVersion("/repo", "patch", runner)).rejects.toThrow(
			"Working tree is not clean",
		);
	});

	it("stops on failing command", async () => {
		const calls: string[] = [];
		const runner = mock(
			async (command: string, args: string[]): Promise<CommandResult> => {
				calls.push(`${command} ${args.join(" ")}`);
				if (command === "bun" && args[1] === "typecheck") {
					return { code: 1, stdout: "", stderr: "typecheck failed" };
				}
				return ok("");
			},
		) as RunCommandFn;

		await expect(runPublishVersion("/repo", "patch", runner)).rejects.toThrow(
			"bun run typecheck failed",
		);
		expect(calls).toEqual([
			"git status --porcelain",
			"npm version patch --no-git-tag-version",
			"bun run check",
			"bun run typecheck",
		]);
	});
});
