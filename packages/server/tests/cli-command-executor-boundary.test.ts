import { describe, expect, it } from "bun:test";

import {
	type CliCommandExecutionHistoryEntry,
	type CliCommandExecutionResult,
	CliCommandExecutor,
	type CliCommandExecutorOptions,
	type CliCommandInvocation,
	type CliCommandRequest,
} from "adhdai/features/server/cli-command-executor";

describe("cli executor boundary export", () => {
	it("allows server to consume executor and boundary types", async () => {
		const request: CliCommandRequest = { action: "projects" };
		const invocation: CliCommandInvocation = { command: "bun", args: ["run"] };
		const failedResult: CliCommandExecutionResult = {
			status: "failed",
			request,
			invocation,
			error: "boom",
		};
		const historyEntry: CliCommandExecutionHistoryEntry = {
			requestedAt: new Date().toISOString(),
			finishedAt: new Date().toISOString(),
			request,
			status: "failed",
			command: invocation.command,
			args: invocation.args,
			error: failedResult.error,
		};

		const options: CliCommandExecutorOptions = {
			cwd: process.cwd(),
			command: "bun",
			baseArgs: ["run", "./packages/cli/src/index.ts"],
			runCommandFn: async () => ({ code: 0, stdout: "ok", stderr: "" }),
		};
		const executor = new CliCommandExecutor(options);
		const result = await executor.execute(request);

		expect(result.status).toBe("succeeded");
		expect(historyEntry.status).toBe("failed");
	});

	it("enforces non-interactive task create from server boundary", async () => {
		const invocations: string[][] = [];
		const executor = new CliCommandExecutor({
			cwd: process.cwd(),
			command: "bun",
			baseArgs: ["run", "./packages/cli/src/index.ts"],
			runCommandFn: async (_command, args) => {
				invocations.push(args);
				return { code: 0, stdout: "ok", stderr: "" };
			},
		});

		const omittedFlag = await executor.execute({
			action: "task",
			taskAction: "create",
			request: "Build task flow",
		});
		const explicitFalse = await executor.execute({
			action: "task",
			taskAction: "create",
			request: "Build task flow",
			nonInteractive: false,
		});

		expect(omittedFlag.status).toBe("succeeded");
		expect(invocations[0]).toContain("--non-interactive");
		expect(explicitFalse.status).toBe("rejected");
		expect(explicitFalse.error).toContain(
			"nonInteractive must be true when provided",
		);
	});
});
