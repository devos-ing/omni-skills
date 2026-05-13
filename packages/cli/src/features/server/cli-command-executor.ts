import { runCommand } from "../../utils/shell";
import type {
	CliCommandExecutionHistoryEntry,
	CliCommandExecutionResult,
	CliCommandExecutorOptions,
	CliCommandInvocation,
	CliCommandRequest,
	SupportedCliCommandRequest,
} from "./cli-command-executor.types";
export type {
	CliCommandExecutionHistoryEntry,
	CliCommandExecutionResult,
	CliCommandExecutorOptions,
	CliCommandInvocation,
	CliCommandRequest,
	RunCommandFn,
	SupportedCliAction,
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
					streamStdout: true,
					streamStderr: true,
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
		const projectIdValidation = validateOptionalStringField(
			request.projectId,
			"run",
			"projectId",
		);
		if (projectIdValidation.status !== "ok") {
			return projectIdValidation;
		}
		const issueKeyValidation = validateOptionalStringField(
			request.issueKey,
			"run",
			"issueKey",
		);
		if (issueKeyValidation.status !== "ok") {
			return issueKeyValidation;
		}
		const allProjectsValidation = validateOptionalBooleanField(
			request.allProjects,
			"run",
			"allProjects",
		);
		if (allProjectsValidation.status !== "ok") {
			return allProjectsValidation;
		}
		const pollValidation = validateOptionalBooleanField(
			request.poll,
			"run",
			"poll",
		);
		if (pollValidation.status !== "ok") {
			return pollValidation;
		}
		const noExitWhenIdleValidation = validateOptionalBooleanField(
			request.noExitWhenIdle,
			"run",
			"noExitWhenIdle",
		);
		if (noExitWhenIdleValidation.status !== "ok") {
			return noExitWhenIdleValidation;
		}
		const isolatedWorktreesValidation = validateOptionalBooleanField(
			request.isolatedWorktrees,
			"run",
			"isolatedWorktrees",
		);
		if (isolatedWorktreesValidation.status !== "ok") {
			return isolatedWorktreesValidation;
		}
		const concurrencyValidation = validateOptionalPositiveIntegerField(
			request.concurrency,
			"run",
			"concurrency",
		);
		if (concurrencyValidation.status !== "ok") {
			return concurrencyValidation;
		}
		const pollIntervalValidation = validateOptionalPositiveIntegerField(
			request.pollIntervalMs,
			"run",
			"pollIntervalMs",
		);
		if (pollIntervalValidation.status !== "ok") {
			return pollIntervalValidation;
		}
		const maxPollCyclesValidation = validateOptionalPositiveIntegerField(
			request.maxPollCycles,
			"run",
			"maxPollCycles",
		);
		if (maxPollCyclesValidation.status !== "ok") {
			return maxPollCyclesValidation;
		}
		const runRequest = request as Extract<
			SupportedCliCommandRequest,
			{ action: "run" }
		>;
		return {
			status: "ok",
			invocation: {
				command,
				args: [
					...baseArgs,
					...buildRunArgs({
						...runRequest,
						projectId: projectIdValidation.value,
						issueKey: issueKeyValidation.value,
						allProjects: allProjectsValidation.value,
						poll: pollValidation.value,
						noExitWhenIdle: noExitWhenIdleValidation.value,
						isolatedWorktrees: isolatedWorktreesValidation.value,
						concurrency: concurrencyValidation.value,
						pollIntervalMs: pollIntervalValidation.value,
						maxPollCycles: maxPollCyclesValidation.value,
					}),
				],
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
	if (request.action === "setup") {
		if (request.check !== undefined && typeof request.check !== "boolean") {
			return {
				status: "error",
				error: "Malformed setup request: check must be a boolean",
			};
		}
		return {
			status: "ok",
			invocation: {
				command,
				args: [...baseArgs, ...buildSetupArgs({ check: request.check })],
			},
		};
	}
	if (request.action === "skills") {
		const skillsResolution = resolveSkillsArgs(
			request as unknown as Record<string, unknown>,
		);
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
		const taskResolution = resolveTaskArgs(
			request as unknown as Record<string, unknown>,
		);
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
	if (request.action === "stop") {
		return {
			status: "error",
			error:
				"Unsupported CLI action: stop (typed stop workflow boundary is not available)",
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

function buildSetupArgs(request: { check?: boolean }): string[] {
	const args = ["setup"];
	appendBooleanFlag(args, "--check", request.check);
	return args;
}

function resolveSkillsArgs(
	request: Record<string, unknown>,
): { status: "ok"; args: string[] } | { status: "error"; error: string } {
	if (!isNonEmptyString(request.skillsAction)) {
		return {
			status: "error",
			error: "Malformed skills request: skillsAction is required",
		};
	}

	if (request.skillsAction === "list") {
		const projectIdValidation = validateOptionalStringField(
			request.projectId,
			"skills list",
			"projectId",
		);
		if (projectIdValidation.status !== "ok") {
			return projectIdValidation;
		}
		const args = ["skills", "list"];
		appendFlag(args, "--project", projectIdValidation.value);
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
		const projectIdValidation = validateOptionalStringField(
			request.projectId,
			"skills add",
			"projectId",
		);
		if (projectIdValidation.status !== "ok") {
			return projectIdValidation;
		}
		appendFlag(args, "--project", projectIdValidation.value);
		return { status: "ok", args };
	}

	if (request.skillsAction === "update") {
		if (!isNonEmptyString(request.name)) {
			return {
				status: "error",
				error: "Malformed skills update request: name is required",
			};
		}
		const titleValidation = validateOptionalStringField(
			request.title,
			"skills update",
			"title",
		);
		if (titleValidation.status !== "ok") {
			return titleValidation;
		}
		const descriptionValidation = validateOptionalStringField(
			request.description,
			"skills update",
			"description",
		);
		if (descriptionValidation.status !== "ok") {
			return descriptionValidation;
		}
		const contentValidation = validateOptionalStringField(
			request.content,
			"skills update",
			"content",
		);
		if (contentValidation.status !== "ok") {
			return contentValidation;
		}
		const projectIdValidation = validateOptionalStringField(
			request.projectId,
			"skills update",
			"projectId",
		);
		if (projectIdValidation.status !== "ok") {
			return projectIdValidation;
		}
		const args = ["skills", "update", request.name];
		appendFlag(args, "--title", titleValidation.value);
		appendFlag(args, "--description", descriptionValidation.value);
		appendFlag(args, "--content", contentValidation.value);
		appendFlag(args, "--project", projectIdValidation.value);
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
		const projectIdValidation = validateOptionalStringField(
			request.projectId,
			"skills remove",
			"projectId",
		);
		if (projectIdValidation.status !== "ok") {
			return projectIdValidation;
		}
		const args = ["skills", "remove", request.name];
		appendFlag(args, "--project", projectIdValidation.value);
		return { status: "ok", args };
	}

	return {
		status: "error",
		error: `Unsupported skills action: ${String(request.skillsAction)}`,
	};
}

function resolveTaskArgs(
	request: Record<string, unknown>,
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
	const projectIdValidation = validateOptionalStringField(
		request.projectId,
		"task create",
		"projectId",
	);
	if (projectIdValidation.status !== "ok") {
		return projectIdValidation;
	}
	const answersValidation = validateOptionalTaskAnswers(request.answers);
	if (answersValidation.status !== "ok") {
		return answersValidation;
	}
	const args = ["task", "create", "--request", request.request];
	appendFlag(args, "--project", projectIdValidation.value);
	if (answersValidation.value) {
		args.push("--answers-json", JSON.stringify(answersValidation.value));
	}
	return { status: "ok", args };
}

function validateOptionalTaskAnswers(value: unknown):
	| {
			status: "ok";
			value: Array<{ question: string; answer: string }> | undefined;
	  }
	| { status: "error"; error: string } {
	if (value === undefined) {
		return { status: "ok", value: undefined };
	}
	if (!Array.isArray(value)) {
		return {
			status: "error",
			error: "Malformed task create request: answers must be an array",
		};
	}
	const answers: Array<{ question: string; answer: string }> = [];
	for (const [index, item] of value.entries()) {
		if (typeof item !== "object" || item === null) {
			return {
				status: "error",
				error: `Malformed task create request: answers[${index}] must be an object`,
			};
		}
		const question = (item as Record<string, unknown>).question;
		const answer = (item as Record<string, unknown>).answer;
		if (!isNonEmptyString(question)) {
			return {
				status: "error",
				error: `Malformed task create request: answers[${index}].question must be a non-empty string`,
			};
		}
		if (!isNonEmptyString(answer)) {
			return {
				status: "error",
				error: `Malformed task create request: answers[${index}].answer must be a non-empty string`,
			};
		}
		answers.push({ question, answer });
	}
	return { status: "ok", value: answers };
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

function validateOptionalStringField(
	value: unknown,
	actionLabel: string,
	fieldName: string,
):
	| { status: "ok"; value: string | undefined }
	| { status: "error"; error: string } {
	if (value === undefined) {
		return { status: "ok", value: undefined };
	}
	if (!isNonEmptyString(value)) {
		return {
			status: "error",
			error: `Malformed ${actionLabel} request: ${fieldName} must be a non-empty string`,
		};
	}
	return { status: "ok", value };
}

function validateOptionalBooleanField(
	value: unknown,
	actionLabel: string,
	fieldName: string,
):
	| { status: "ok"; value: boolean | undefined }
	| { status: "error"; error: string } {
	if (value === undefined) {
		return { status: "ok", value: undefined };
	}
	if (typeof value !== "boolean") {
		return {
			status: "error",
			error: `Malformed ${actionLabel} request: ${fieldName} must be a boolean`,
		};
	}
	return { status: "ok", value };
}

function validateOptionalPositiveIntegerField(
	value: unknown,
	actionLabel: string,
	fieldName: string,
):
	| { status: "ok"; value: number | undefined }
	| { status: "error"; error: string } {
	if (value === undefined) {
		return { status: "ok", value: undefined };
	}
	if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
		return {
			status: "error",
			error: `Malformed ${actionLabel} request: ${fieldName} must be a positive integer`,
		};
	}
	return { status: "ok", value };
}
