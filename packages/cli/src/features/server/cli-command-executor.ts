import { runCommand } from "../../utils/shell";
import type {
	CliCommandExecutionHistoryEntry,
	CliCommandExecutionResult,
	CliCommandExecutorOptions,
	CliCommandInvocation,
	CliCommandRequest,
	SupportedCliCommandRequest,
} from "./cli-command-executor.types";

const DEFAULT_MAX_HISTORY_ENTRIES = 100;

export class CliCommandExecutor {
	private readonly history: CliCommandExecutionHistoryEntry[] = [];

	constructor(private readonly options: CliCommandExecutorOptions) {}

	getHistory(): CliCommandExecutionHistoryEntry[] {
		return [...this.history];
	}

	async execute(
		request: CliCommandRequest,
	): Promise<CliCommandExecutionResult> {
		const requestedAt = new Date().toISOString();
		const invocation = toInvocation(
			request,
			this.options.command,
			this.options.baseArgs,
		);
		if (!invocation) {
			return this.record({
				requestedAt,
				request,
				status: "rejected",
				error: `Unsupported CLI action: ${request.action}`,
			});
		}

		try {
			const commandResult = await (this.options.runCommandFn ?? runCommand)(
				invocation.command,
				invocation.args,
				{
					cwd: this.options.cwd,
					env: this.options.env,
				},
			);
			const status = commandResult.code === 0 ? "succeeded" : "failed";
			return this.record({
				requestedAt,
				request,
				status,
				invocation,
				commandResult,
			});
		} catch (error) {
			return this.record({
				requestedAt,
				request,
				status: "failed",
				invocation,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	private record(
		result: CliCommandExecutionResult & { requestedAt: string },
	): CliCommandExecutionResult {
		const finishedAt = new Date().toISOString();
		this.history.push({
			requestedAt: result.requestedAt,
			finishedAt,
			request: result.request,
			status: result.status,
			command: result.invocation?.command,
			args: result.invocation?.args,
			exitCode: result.commandResult?.code,
			stdout: result.commandResult?.stdout,
			stderr: result.commandResult?.stderr,
			error:
				result.error ??
				(result.commandResult && result.commandResult.code !== 0
					? result.commandResult.stderr || result.commandResult.stdout
					: undefined),
		});
		const maxEntries =
			this.options.maxHistoryEntries ?? DEFAULT_MAX_HISTORY_ENTRIES;
		if (this.history.length > maxEntries) {
			this.history.splice(0, this.history.length - maxEntries);
		}
		const { requestedAt: _requestedAt, ...publicResult } = result;
		return publicResult;
	}
}

function toInvocation(
	request: CliCommandRequest,
	command: string,
	baseArgs: string[],
): CliCommandInvocation | undefined {
	if (request.action === "run") {
		return {
			command,
			args: [...baseArgs, ...buildRunArgs(request)],
		};
	}
	if (request.action === "status") {
		return {
			command,
			args: [...baseArgs, ...buildStatusArgs(request)],
		};
	}
	if (request.action === "projects") {
		return {
			command,
			args: [...baseArgs, "projects"],
		};
	}
	return undefined;
}

function buildRunArgs(
	request: Extract<SupportedCliCommandRequest, { action: "run" }>,
): string[] {
	const args = ["run"];
	appendFlag(args, "--project", request.projectId);
	appendFlag(args, "--issue", request.issueKey);
	appendBooleanFlag(args, "--all-projects", request.allProjects);
	appendBooleanFlag(args, "--poll", request.poll);
	if (request.noExitWhenIdle) {
		args.push("--no-exit-when-idle");
	}
	appendNumericFlag(args, "--concurrency", request.concurrency);
	appendNumericFlag(args, "--poll-interval-ms", request.pollIntervalMs);
	appendNumericFlag(args, "--max-poll-cycles", request.maxPollCycles);
	appendBooleanFlag(args, "--isolated-worktrees", request.isolatedWorktrees);
	return args;
}

function buildStatusArgs(
	request: Extract<SupportedCliCommandRequest, { action: "status" }>,
): string[] {
	return [
		"status",
		"--project",
		request.projectId,
		"--issue",
		request.issueKey,
	];
}

function appendBooleanFlag(
	args: string[],
	name: string,
	enabled: boolean | undefined,
): void {
	if (enabled) {
		args.push(name);
	}
}

function appendFlag(
	args: string[],
	name: string,
	value: string | undefined,
): void {
	if (value) {
		args.push(name, value);
	}
}

function appendNumericFlag(
	args: string[],
	name: string,
	value: number | undefined,
): void {
	if (value !== undefined) {
		args.push(name, String(value));
	}
}
