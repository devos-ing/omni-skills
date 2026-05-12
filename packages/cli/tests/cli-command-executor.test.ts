import { describe, expect, it } from "bun:test";
import { CliCommandExecutor } from "../src/features/server/cli-command-executor";
import type { RunCommandFn } from "../src/features/server/cli-command-executor.types";

describe("CliCommandExecutor", () => {
	it("executes allowed run action with structured argv", async () => {
		const calls: Array<{ command: string; args: string[] }> = [];
		const runCommandFn: RunCommandFn = async (command, args) => {
			calls.push({ command, args });
			return { code: 0, stdout: "ok", stderr: "" };
		};
		const executor = new CliCommandExecutor({
			cwd: "/tmp/work",
			command: "bun",
			baseArgs: ["run", "./packages/cli/src/index.ts"],
			runCommandFn,
		});

		const result = await executor.execute({
			action: "run",
			projectId: "default",
			issueKey: "ROY-122",
			poll: true,
			concurrency: 2,
		});

		expect(result.status).toBe("succeeded");
		expect(calls).toEqual([
			{
				command: "bun",
				args: [
					"run",
					"./packages/cli/src/index.ts",
					"run",
					"--project",
					"default",
					"--issue",
					"ROY-122",
					"--poll",
					"--concurrency",
					"2",
				],
			},
		]);
		const history = executor.getHistory();
		expect(history).toHaveLength(1);
		expect(history[0]?.status).toBe("succeeded");
		expect(history[0]?.command).toBe("bun");
	});

	it("rejects unsupported actions without execution", async () => {
		let callCount = 0;
		const runCommandFn: RunCommandFn = async () => {
			callCount += 1;
			return { code: 0, stdout: "", stderr: "" };
		};
		const executor = new CliCommandExecutor({
			cwd: "/tmp/work",
			command: "bun",
			baseArgs: ["run", "./packages/cli/src/index.ts"],
			runCommandFn,
		});

		const result = await executor.execute({ action: "dangerous-shell" });

		expect(result.status).toBe("rejected");
		expect(result.error).toContain("Unsupported CLI action");
		expect(callCount).toBe(0);
		const history = executor.getHistory();
		expect(history).toHaveLength(1);
		expect(history[0]?.status).toBe("rejected");
	});

	it("records failed status and stderr for non-zero exits", async () => {
		const runCommandFn: RunCommandFn = async () => ({
			code: 1,
			stdout: "",
			stderr: "boom",
		});
		const executor = new CliCommandExecutor({
			cwd: "/tmp/work",
			command: "bun",
			baseArgs: ["run", "./packages/cli/src/index.ts"],
			runCommandFn,
		});

		const result = await executor.execute({
			action: "status",
			projectId: "default",
			issueKey: "ROY-122",
		});

		expect(result.status).toBe("failed");
		expect(result.commandResult?.code).toBe(1);
		const history = executor.getHistory();
		expect(history).toHaveLength(1);
		expect(history[0]?.status).toBe("failed");
		expect(history[0]?.stderr).toBe("boom");
		expect(history[0]?.error).toBe("boom");
	});

	it("records spawn errors as failed results", async () => {
		const runCommandFn: RunCommandFn = async () => {
			throw new Error("spawn EACCES");
		};
		const executor = new CliCommandExecutor({
			cwd: "/tmp/work",
			command: "bun",
			baseArgs: ["run", "./packages/cli/src/index.ts"],
			runCommandFn,
		});

		const result = await executor.execute({ action: "projects" });

		expect(result.status).toBe("failed");
		expect(result.error).toBe("spawn EACCES");
		const history = executor.getHistory();
		expect(history).toHaveLength(1);
		expect(history[0]?.status).toBe("failed");
		expect(history[0]?.error).toBe("spawn EACCES");
	});
});
