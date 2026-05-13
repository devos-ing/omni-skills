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
});
