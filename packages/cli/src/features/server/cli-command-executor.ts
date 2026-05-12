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
		const resolution = resolveInvocation(
			request,
			this.options.command,
			this.options.baseArgs,
		);
		if (resolution.status !== "ok") {
			return this.record({
				requestedAt,
				request,
				status: "rejected",
				error: resolution.error,
			});
		}
		const invocation = resolution.invocation;

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

function resolveInvocation(
	request: CliCommandRequest,
	command: string,
	baseArgs: string[],
):
	| { status: "ok"; invocation: CliCommandInvocation }
	| { status: "error"; error: string } {
	if (request.action === "run") {
		const runRequest = request as Extract<
			SupportedCliCommandRequest,
			{ action: "run" }
		>;
		return {
			status: "ok",
			invocation: {
				command,
				args: [...baseArgs, ...buildRunArgs(runRequest)],
			},
		};
	}
	if (request.action === "status") {
		if (!isNonEmptyString(request.projectId)) {
			return {
				status: "error",
				error: "Malformed status request: projectId is required",
			};
		}
		if (!isNonEmptyString(request.issueKey)) {
			return {
				status: "error",
				error: "Malformed status request: issueKey is required",
			};
		}
		return {
			status: "ok",
			invocation: {
				command,
				args: [
					...baseArgs,
					...buildStatusArgs({
						action: "status",
						projectId: request.projectId,
						issueKey: request.issueKey,
					}),
				],
			},
		};
	}
	if (request.action === "projects") {
		return {
			status: "ok",
			invocation: {
				command,
				args: [...baseArgs, "projects"],
			},
		};
	}
	if (request.action === "cron") {
		return {
			status: "ok",
			invocation: {
				command,
				args: [...baseArgs, ...buildCronArgs(request)],
			},
		};
	}
	if (request.action === "setup") {
		return {
			status: "ok",
			invocation: {
				command,
				args: [...baseArgs, ...buildSetupArgs(request)],
			},
		};
	}
	if (request.action === "skills") {
		const skillsResolution = resolveSkillsArgs(request);
		if (skillsResolution.status !== "ok") {
			return skillsResolution;
		}
		return {
			status: "ok",
			invocation: {
				command,
				args: [...baseArgs, ...skillsResolution.args],
			},
		};
	}
	if (request.action === "task") {
		const taskResolution = resolveTaskArgs(request);
		if (taskResolution.status !== "ok") {
			return taskResolution;
		}
		return {
			status: "ok",
			invocation: {
				command,
				args: [...baseArgs, ...taskResolution.args],
			},
		};
	}
	return {
		status: "error",
		error: `Unsupported CLI action: ${request.action}`,
	};
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

function buildCronArgs(
	request: Extract<SupportedCliCommandRequest, { action: "cron" }>,
): string[] {
	const args = ["cron"];
	appendBooleanFlag(args, "--once", request.once);
	appendFlag(args, "--job", request.jobId);
	return args;
}

function buildSetupArgs(
	request: Extract<SupportedCliCommandRequest, { action: "setup" }>,
): string[] {
	const args = ["setup"];
	appendBooleanFlag(args, "--check", request.check);
	return args;
}

function resolveSkillsArgs(
	request: CliCommandRequest,
): { status: "ok"; args: string[] } | { status: "error"; error: string } {
	if (!isNonEmptyString(request.skillsAction)) {
		return {
			status: "error",
			error: "Malformed skills request: skillsAction is required",
		};
	}

	if (request.skillsAction === "list") {
		const args = ["skills", "list"];
		appendFlag(args, "--project", asOptionalString(request.projectId));
		return { status: "ok", args };
	}

	if (request.skillsAction === "add") {
		if (!isNonEmptyString(request.title)) {
			return {
				status: "error",
				error: "Malformed skills add request: title is required",
			};
		}
		if (!isNonEmptyString(request.description)) {
			return {
				status: "error",
				error: "Malformed skills add request: description is required",
			};
		}
		if (!isNonEmptyString(request.content)) {
			return {
				status: "error",
				error: "Malformed skills add request: content is required",
			};
		}
		const args = [
			"skills",
			"add",
			"--title",
			request.title,
			"--description",
			request.description,
			"--content",
			request.content,
		];
		appendFlag(args, "--project", asOptionalString(request.projectId));
		return { status: "ok", args };
	}

	if (request.skillsAction === "update") {
		if (!isNonEmptyString(request.name)) {
			return {
				status: "error",
				error: "Malformed skills update request: name is required",
			};
		}
		const args = ["skills", "update", request.name];
		appendFlag(args, "--title", asOptionalString(request.title));
		appendFlag(args, "--description", asOptionalString(request.description));
		appendFlag(args, "--content", asOptionalString(request.content));
		appendFlag(args, "--project", asOptionalString(request.projectId));
		if (
			!args.includes("--title") &&
			!args.includes("--description") &&
			!args.includes("--content")
		) {
			return {
				status: "error",
				error:
					"Malformed skills update request: at least one of title, description, or content is required",
			};
		}
		return { status: "ok", args };
	}

	if (request.skillsAction === "remove") {
		if (!isNonEmptyString(request.name)) {
			return {
				status: "error",
				error: "Malformed skills remove request: name is required",
			};
		}
		const args = ["skills", "remove", request.name];
		appendFlag(args, "--project", asOptionalString(request.projectId));
		return { status: "ok", args };
	}

	return {
		status: "error",
		error: `Unsupported skills action: ${String(request.skillsAction)}`,
	};
}

function resolveTaskArgs(
	request: CliCommandRequest,
): { status: "ok"; args: string[] } | { status: "error"; error: string } {
	if (!isNonEmptyString(request.taskAction)) {
		return {
			status: "error",
			error: "Malformed task request: taskAction is required",
		};
	}
	if (request.taskAction !== "create") {
		return {
			status: "error",
			error: `Unsupported task action: ${String(request.taskAction)}`,
		};
	}
	if (!isNonEmptyString(request.request)) {
		return {
			status: "error",
			error: "Malformed task create request: request is required",
		};
	}
	const args = ["task", "create", "--request", request.request];
	appendFlag(args, "--project", asOptionalString(request.projectId));
	return { status: "ok", args };
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

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function asOptionalString(value: unknown): string | undefined {
	return isNonEmptyString(value) ? value : undefined;
}
