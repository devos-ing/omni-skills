import { renderAgentPrompt } from "../request-prompt";
import { runCommand } from "../shell";
import { emitStreamEvent } from "../streaming";
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
import { mapCursorError } from "./errors";
import { extractFinalMessage, extractSessionId, extractUsage } from "./output";

export class CursorAgentAdapter implements AgentAdapter {
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
		return this.runCursor(args, validatedRequest);
	}

	private buildNewSessionArgs(prompt: string): string[] {
		return this.appendOptionalArgs(["-p", prompt, "--output-format", "json"]);
	}

	private buildResumeArgs(sessionId: string, prompt: string): string[] {
		return this.appendOptionalArgs([
			"--resume",
			sessionId,
			"-p",
			prompt,
			"--output-format",
			"json",
		]);
	}

	private appendOptionalArgs(args: string[]): string[] {
		const model = this.config.cursor?.model?.trim();
		if (model && model.toLowerCase() !== "auto") {
			args.push("--model", model);
		}
		if (this.config.cursor?.force) {
			args.push("--force");
		}
		return args;
	}

	private async runCursor(
		args: string[],
		request: AgentAdapterRunRequest,
	): Promise<AgentResult> {
		const binary = this.config.cursor?.binary ?? "cursor-agent";
		const cwd = this.config.executionPath;
		const result = await runCommand(binary, args, {
			cwd,
			env: this.buildEnv(),
			streamStdout:
				this.config.cursor?.streamLogs ?? this.config.codex.streamLogs,
			streamStderr:
				this.config.cursor?.streamLogs ?? this.config.codex.streamLogs,
			stdinMode: "ignore",
			onStdout: (text) => emitStreamEvent(request, "stdout", text),
			onStderr: (text) => emitStreamEvent(request, "stderr", text),
		}).catch((error) => {
			throw mapCursorError(
				binary,
				args,
				{
					code: 127,
					stdout: "",
					stderr: error instanceof Error ? error.message : String(error),
				},
				{
					cwd,
					request,
				},
			);
		});

		if (result.code !== 0) {
			throw mapCursorError(binary, args, result, { cwd, request });
		}

		return {
			sessionId: extractSessionId(result.stdout) ?? request.sessionId,
			finalMessage: extractFinalMessage(result.stdout),
			stdout: result.stdout,
			stderr: result.stderr,
			traceId: request.traceId,
			backend: "cursor-agent",
			usage: extractUsage(result.stdout),
		};
	}

	private buildEnv(): Record<string, string> | undefined {
		const apiKey = this.config.cursor?.apiKey?.trim();
		return apiKey ? { CURSOR_API_KEY: apiKey } : undefined;
	}
}
