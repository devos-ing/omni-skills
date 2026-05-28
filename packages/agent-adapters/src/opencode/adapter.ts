import { runCommand } from "../shared/execute/shell";
import { renderAgentPrompt } from "../shared/skills/request-prompt";
import { emitStreamEvent } from "../shared/streaming/events";
import type {
	AgentAdapter,
	AgentAdapterRunRequest,
	AgentAdapterRuntimeConfig,
	AgentResult,
} from "../types/agent-adapter.types";
import {
	validateAgentAdapterRunRequest,
	validateAgentAdapterRuntimeConfig,
} from "../validation";
import { mapOpenCodeError } from "./errors";
import { extractFinalMessage, extractSessionId, extractUsage } from "./output";

export class OpenCodeAdapter implements AgentAdapter {
	constructor(config: AgentAdapterRuntimeConfig) {
		this.config = validateAgentAdapterRuntimeConfig(config);
	}

	private config: AgentAdapterRuntimeConfig;

	async runPlan(prompt: string): Promise<AgentResult> {
		return this.runAgent({ role: "planning", prompt });
	}

	async runTaskIntake(prompt: string): Promise<AgentResult> {
		return this.runAgent({ role: "task-intake", prompt });
	}

	async resume(sessionId: string, prompt: string): Promise<AgentResult> {
		return this.runAgent({ role: "implementing", prompt, sessionId });
	}

	async runReview(prompt: string): Promise<AgentResult> {
		return this.runAgent({ role: "review-testing", prompt });
	}

	async runGithubComment(prompt: string): Promise<AgentResult> {
		return this.runAgent({ role: "github-comment", prompt });
	}

	async runAgent(request: AgentAdapterRunRequest): Promise<AgentResult> {
		const validatedRequest = validateAgentAdapterRunRequest(request);
		const prompt = renderAgentPrompt(validatedRequest);
		const args = validatedRequest.sessionId
			? this.buildResumeArgs(validatedRequest.sessionId, prompt)
			: this.buildNewSessionArgs(prompt);
		return this.runOpenCode(args, validatedRequest);
	}

	private buildNewSessionArgs(prompt: string): string[] {
		return this.appendOptionalArgs(["run", "--format", "json", prompt]);
	}

	private buildResumeArgs(sessionId: string, prompt: string): string[] {
		return this.appendOptionalArgs([
			"run",
			"--format",
			"json",
			"--session",
			sessionId,
			prompt,
		]);
	}

	private appendOptionalArgs(args: string[]): string[] {
		args.splice(3, 0, "--dir", this.config.executionPath);
		const model = this.config.opencode?.model?.trim();
		if (model) args.splice(args.length - 1, 0, "--model", model);
		const agent = this.config.opencode?.agent?.trim();
		if (agent) args.splice(args.length - 1, 0, "--agent", agent);
		const attach = this.config.opencode?.attach?.trim();
		if (attach) args.splice(args.length - 1, 0, "--attach", attach);
		if (this.config.opencode?.dangerouslySkipPermissions) {
			args.splice(args.length - 1, 0, "--dangerously-skip-permissions");
		}
		return args;
	}

	private async runOpenCode(
		args: string[],
		request: AgentAdapterRunRequest,
	): Promise<AgentResult> {
		const binary = this.config.opencode?.binary ?? "opencode";
		const cwd = this.config.executionPath;
		const result = await runCommand(binary, args, {
			cwd,
			streamStdout:
				this.config.opencode?.streamLogs ?? this.config.codex.streamLogs,
			streamStderr:
				this.config.opencode?.streamLogs ?? this.config.codex.streamLogs,
			stdinMode: "ignore",
			onStdout: (text) => emitStreamEvent(request, "stdout", text),
			onStderr: (text) => emitStreamEvent(request, "stderr", text),
		}).catch((error) => {
			throw mapOpenCodeError(
				binary,
				args,
				{
					code: 127,
					stdout: "",
					stderr: error instanceof Error ? error.message : String(error),
				},
				{ cwd, request },
			);
		});

		if (result.code !== 0) {
			throw mapOpenCodeError(binary, args, result, { cwd, request });
		}

		return {
			sessionId: extractSessionId(result.stdout) ?? request.sessionId,
			finalMessage: extractFinalMessage(result.stdout),
			stdout: result.stdout,
			stderr: result.stderr,
			traceId: request.traceId,
			backend: "opencode",
			usage: extractUsage(result.stdout),
		};
	}
}
