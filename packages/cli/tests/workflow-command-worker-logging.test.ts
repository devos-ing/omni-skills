import { describe, expect, it } from "bun:test";
import {
	buildWorkerActionLogContext,
	buildWorkflowCommandWorkerExecutorOptions,
	logWorkerActionReceived,
	logWorkerStreamEvent,
} from "../src/features/daemon";
import type { WorkflowCommandWorkerLogger } from "../src/features/daemon";

describe("workflow command worker logging", () => {
	it("uses bun for worker-owned command execution", () => {
		expect(
			buildWorkflowCommandWorkerExecutorOptions({
				cwd: "/repo",
				env: { DEVOS_SERVER_BASE_URL: "http://127.0.0.1:3001" },
			}),
		).toEqual({
			cwd: "/repo",
			command: "bun",
			baseArgs: ["run", "packages/cli/src/index.ts"],
			env: {
				DEVOS_SERVER_BASE_URL: "http://127.0.0.1:3001",
				DEVOS_WORKFLOW_PROGRESS_STREAM: "1",
			},
		});
	});

	it("logs command actions with only safe routing fields", () => {
		const entries: LogEntry[] = [];
		const logger = createLogger(entries);

		logWorkerActionReceived(logger, "req-1", {
			action: "task",
			taskAction: "create",
			projectId: "api",
			request: "secret task body",
			clarificationAnswers: [{ question: "Token?", answer: "secret" }],
		});

		expect(entries).toEqual([
			{
				level: "info",
				context: {
					requestId: "req-1",
					action: "task",
					projectId: "api",
					taskAction: "create",
				},
				message: "CLI worker action received",
			},
		]);
		expect(JSON.stringify(entries[0]?.context)).not.toContain("secret");
	});

	it("omits skill content and other unsafe payload fields from log context", () => {
		const context = buildWorkerActionLogContext("req-2", {
			action: "skills",
			skillsAction: "add",
			projectId: "api",
			title: "Private skill",
			description: "Description",
			content: "do not log this skill content",
		});

		expect(context).toEqual({
			requestId: "req-2",
			action: "skills",
			projectId: "api",
			skillsAction: "add",
		});
		expect(JSON.stringify(context)).not.toContain("do not log");
	});

	it("logs command completion and error stream events", () => {
		const entries: LogEntry[] = [];
		const logger = createLogger(entries);
		const request = { action: "run" as const, projectId: "api" };

		logWorkerStreamEvent(logger, "req-4", request, {
			type: "error",
			error: "worker rejected task",
		});
		logWorkerStreamEvent(logger, "req-4", request, {
			type: "complete",
			result: {
				status: "failed",
				request,
				commandResult: { code: 7, stdout: "", stderr: "failed" },
			},
		});

		expect(entries).toEqual([
			{
				level: "error",
				context: {
					requestId: "req-4",
					action: "run",
					projectId: "api",
					error: "worker rejected task",
				},
				message: "CLI worker action error",
			},
			{
				level: "info",
				context: {
					requestId: "req-4",
					action: "run",
					projectId: "api",
					status: "failed",
					exitCode: 7,
				},
				message: "CLI worker action completed",
			},
		]);
	});
});

interface LogEntry {
	level: "info" | "warn" | "error";
	context: Record<string, unknown>;
	message: string;
}

function createLogger(entries: LogEntry[]): WorkflowCommandWorkerLogger {
	return {
		info: (context, message) => {
			entries.push({ level: "info", context, message });
		},
		warn: (context, message) => {
			entries.push({ level: "warn", context, message });
		},
		error: (context, message) => {
			entries.push({ level: "error", context, message });
		},
	};
}
