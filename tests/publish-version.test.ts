import { describe, expect, it, mock } from "bun:test";
import {
	type RunCommandFn,
	runPublishVersion,
} from "../scripts/publish-version";
import type { CommandResult } from "../src/utils/shell";

function ok(stdout = ""): CommandResult {
	return { code: 0, stdout, stderr: "" };
}

describe("runPublishVersion", () => {
	it("runs release commands in sequence", async () => {
		const calls: Array<{ command: string; args: string[] }> = [];
		const runner = mock(
			async (command: string, args: string[]): Promise<CommandResult> => {
				calls.push({ command, args });
				return ok("");
			},
		) as RunCommandFn;

		await runPublishVersion("/repo", runner);

		expect(calls).toEqual([
			{ command: "git", args: ["status", "--porcelain"] },
			{ command: "bun", args: ["run", "changeset", "version"] },
			{ command: "bun", args: ["run", "check"] },
			{ command: "bun", args: ["run", "typecheck"] },
			{ command: "bun", args: ["test"] },
			{ command: "bun", args: ["run", "build"] },
			{ command: "bun", args: ["run", "changeset", "publish"] },
		]);
	});

	it("fails when worktree is dirty", async () => {
		const runner = mock(async (command: string): Promise<CommandResult> => {
			if (command === "git") {
				return ok(" M package.json\n");
			}
			return ok("");
		}) as RunCommandFn;

		await expect(runPublishVersion("/repo", runner)).rejects.toThrow(
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

		await expect(runPublishVersion("/repo", runner)).rejects.toThrow(
			"bun run typecheck failed",
		);
		expect(calls).toEqual([
			"git status --porcelain",
			"bun run changeset version",
			"bun run check",
			"bun run typecheck",
		]);
	});
});
