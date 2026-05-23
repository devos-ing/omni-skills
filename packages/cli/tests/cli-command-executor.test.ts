import { describe, expect, it } from "bun:test";
import {
	WORKFLOW_PROGRESS_SENTINEL,
	serializeWorkflowProgressEvent,
} from "../src/features/server";
import { CliCommandExecutor } from "../src/features/server/cli-command-executor";
import type {
	CliCommandExecutionResult,
	CliCommandStreamEvent,
	RunCommandFn,
} from "../src/features/server/cli-command-executor.types";
import { CLI_COMMAND_SIMULATION_MATRIX } from "./cli-command-executor-simulation-matrix";

const DEFAULT_OPTIONS = {
	cwd: "/tmp/work",
	command: "npx",
	baseArgs: ["devos"] as string[],
};

describe("CliCommandExecutor", () => {
	it("simulates every supported command variant with structured argv and history capture", async () => {
		for (const simulation of CLI_COMMAND_SIMULATION_MATRIX) {
			const calls: Array<{
				command: string;
				args: string[];
				options: {
					cwd: string;
					env?: NodeJS.ProcessEnv;
					stdinMode?: "pipe" | "ignore" | "inherit";
					streamStdout?: boolean;
					streamStderr?: boolean;
				};
			}> = [];
			const runCommandFn: RunCommandFn = async (command, args, options) => {
				calls.push({ command, args, options });
				return simulation.commandResult;
			};
			const executor = new CliCommandExecutor({
				...DEFAULT_OPTIONS,
				runCommandFn,
			});

			const result = await executor.execute(simulation.request);

			expect(result.status, simulation.name).toBe(simulation.expectedStatus);
			expect(calls, simulation.name).toEqual([
				{
					command: "npx",
					args: simulation.expectedArgs,
					options: {
						cwd: "/tmp/work",
						streamStdout: true,
						streamStderr: true,
					},
				},
			]);
			assertHistory(executor.getHistory()[0], result, simulation.expectedError);
		}
	});

	it("records spawn errors as failed results with invocation metadata", async () => {
		const runCommandFn: RunCommandFn = async () => {
			throw new Error("spawn EACCES");
		};
		const executor = new CliCommandExecutor({
			...DEFAULT_OPTIONS,
			runCommandFn,
		});

		const result = await executor.execute({ action: "onboard" });
		const history = executor.getHistory();

		expect(result.status).toBe("failed");
		expect(result.error).toBe("spawn EACCES");
		expect(history).toHaveLength(1);
		expect(history[0]?.status).toBe("failed");
		expect(history[0]?.error).toBe("spawn EACCES");
		expect(history[0]?.args).toEqual(["devos", "onboard"]);
	});

	it("streams invocation, output, and completion events", async () => {
		const events: CliCommandStreamEvent[] = [];
		const runCommandFn: RunCommandFn = async (_command, _args, options) => {
			options.onStdout?.("hello\n");
			options.onStderr?.("warn\n");
			return { code: 0, stdout: "hello\n", stderr: "warn\n" };
		};
		const executor = new CliCommandExecutor({
			...DEFAULT_OPTIONS,
			runCommandFn,
		});

		const result = await executor.executeStream(
			{ action: "onboard" },
			(event) => events.push(event),
		);

		expect(result.status).toBe("succeeded");
		expect(events.map((event) => event.type)).toEqual([
			"start",
			"stdout",
			"stderr",
			"complete",
		]);
		expect(events[0]).toMatchObject({
			type: "start",
			invocation: { command: "npx", args: ["devos", "onboard"] },
		});
		expect(events[1]).toEqual({ type: "stdout", text: "hello\n" });
		expect(events[2]).toEqual({ type: "stderr", text: "warn\n" });
		expect(events[3]).toEqual({ type: "complete", result });
		assertHistory(executor.getHistory()[0], result);
	});

	it("converts workflow progress sentinels into typed stream events", async () => {
		const events: CliCommandStreamEvent[] = [];
		const progressEvent = {
			schema: "devos.workflow.stream.v1" as const,
			emittedAt: "2026-05-16T00:00:00.000Z",
			kind: "stage" as const,
			projectId: "default",
			issueKey: "TASK-1",
			stage: "planning",
			status: "started" as const,
		};
		const runCommandFn: RunCommandFn = async (_command, _args, options) => {
			options.onStdout?.("before\n");
			options.onStdout?.(serializeWorkflowProgressEvent(progressEvent));
			options.onStdout?.("after\n");
			return {
				code: 0,
				stdout: "before\nafter\n",
				stderr: "",
			};
		};
		const executor = new CliCommandExecutor({
			...DEFAULT_OPTIONS,
			runCommandFn,
		});

		const result = await executor.executeStream(
			{ action: "onboard" },
			(event) => events.push(event),
		);

		expect(events.map((event) => event.type)).toEqual([
			"start",
			"stdout",
			"progress",
			"stdout",
			"complete",
		]);
		expect(events[2]).toEqual({ type: "progress", event: progressEvent });
		expect(result.commandResult?.stdout).toBe("before\nafter\n");
	});

	it("turns malformed workflow progress sentinels into progress log events", async () => {
		const events: CliCommandStreamEvent[] = [];
		const runCommandFn: RunCommandFn = async (_command, _args, options) => {
			options.onStdout?.(`${WORKFLOW_PROGRESS_SENTINEL}{not-json}\n`);
			return { code: 0, stdout: "", stderr: "" };
		};
		const executor = new CliCommandExecutor({
			...DEFAULT_OPTIONS,
			runCommandFn,
		});

		await executor.executeStream({ action: "onboard" }, (event) =>
			events.push(event),
		);

		expect(events[1]).toMatchObject({
			type: "progress",
			event: {
				kind: "log",
				stream: "daemon",
				level: "error",
			},
		});
	});

	it("streams rejected requests without spawning", async () => {
		let callCount = 0;
		const events: CliCommandStreamEvent[] = [];
		const runCommandFn: RunCommandFn = async () => {
			callCount += 1;
			return { code: 0, stdout: "", stderr: "" };
		};
		const executor = new CliCommandExecutor({
			...DEFAULT_OPTIONS,
			runCommandFn,
		});

		const result = await executor.executeStream(
			{ action: "unknown-action" },
			(event) => events.push(event),
		);

		expect(callCount).toBe(0);
		expect(result.status).toBe("rejected");
		expect(events.map((event) => event.type)).toEqual(["error", "complete"]);
		expect(events[0]).toMatchObject({
			type: "error",
			error: "Unsupported CLI action: unknown-action",
		});
		expect(events[1]).toEqual({ type: "complete", result });
		assertHistory(executor.getHistory()[0], result);
	});

	it("rejects unsupported and malformed requests without execution", async () => {
		let callCount = 0;
		const runCommandFn: RunCommandFn = async () => {
			callCount += 1;
			return { code: 0, stdout: "", stderr: "" };
		};
		const executor = new CliCommandExecutor({
			...DEFAULT_OPTIONS,
			runCommandFn,
		});

		const unsupportedAction = await executor.execute({
			action: "dangerous-shell",
		});
		const unknownAction = await executor.execute({
			action: "unknown-action",
		} as unknown as { action: string });
		const stopAction = await executor.execute({
			action: "stop",
		} as unknown as { action: string });
		const legacySetup = await executor.execute({
			action: "setup",
		} as unknown as { action: string });
		const malformedOnboard = await executor.execute({
			action: "onboard",
			check: "false",
		} as unknown as { action: string });
		const malformedStatus = await executor.execute({
			action: "status",
			issueKey: "ROY-122",
		} as unknown as { action: string });
		const malformedSkillsAction = await executor.execute({
			action: "skills",
		} as unknown as { action: string });
		const malformedTaskCreate = await executor.execute({
			action: "task",
			taskAction: "create",
			request: "   ",
		} as unknown as { action: string });
		const malformedTaskUnsafeField = await executor.execute({
			action: "task",
			taskAction: "create",
			request: "Build flow",
			stdinMode: "pipe",
		} as unknown as { action: string });
		const malformedRunField = await executor.execute({
			action: "run",
			concurrency: 0,
		} as unknown as { action: string });
		const malformedRunTargetConflict = await executor.execute({
			action: "run",
			projectId: "default",
			allProjects: true,
		} as unknown as { action: string });
		const malformedPollForever = await executor.execute({
			action: "run",
			pollForever: true,
			maxPollCycles: 2,
		} as unknown as { action: string });

		expect(unsupportedAction.status).toBe("rejected");
		expect(unsupportedAction.error).toContain("Unsupported CLI action");
		expect(unknownAction.status).toBe("rejected");
		expect(stopAction.status).toBe("rejected");
		expect(stopAction.error).toContain("typed stop workflow boundary");
		expect(legacySetup.status).toBe("rejected");
		expect(legacySetup.error).toBe("Unsupported CLI action: setup");
		expect(malformedOnboard.status).toBe("rejected");
		expect(malformedOnboard.error).toBe(
			"Malformed onboard request: check must be a boolean",
		);
		expect(malformedStatus.status).toBe("rejected");
		expect(malformedSkillsAction.status).toBe("rejected");
		expect(malformedTaskCreate.status).toBe("rejected");
		expect(malformedTaskUnsafeField.status).toBe("rejected");
		expect(malformedRunField.status).toBe("rejected");
		expect(malformedRunTargetConflict.status).toBe("rejected");
		expect(malformedRunTargetConflict.error).toContain(
			"projectId cannot be combined",
		);
		expect(malformedPollForever.status).toBe("rejected");
		expect(malformedPollForever.error).toContain(
			"pollForever cannot be combined",
		);
		expect(callCount).toBe(0);
	});
});

function assertHistory(
	history: ReturnType<CliCommandExecutor["getHistory"]>[number] | undefined,
	result: CliCommandExecutionResult,
	expectedError?: string,
): void {
	expect(history).toBeDefined();
	expect(history?.status).toBe(result.status);
	expect(history?.exitCode).toBe(result.commandResult?.code);
	expect(history?.stdout).toBe(result.commandResult?.stdout);
	expect(history?.stderr).toBe(result.commandResult?.stderr);
	expect(history?.requestedAt).toBeString();
	expect(history?.finishedAt).toBeString();
	if (expectedError) {
		expect(history?.error).toBe(expectedError);
	}
}
