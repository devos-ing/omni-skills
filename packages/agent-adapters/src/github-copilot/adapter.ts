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
import { mapGitHubCopilotError } from "./errors";
import { extractFinalMessage } from "./output";

export class GitHubCopilotAdapter implements AgentAdapter {
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
		const prompt = this.renderPrompt(validatedRequest);
		return this.runGitHubCopilot(this.buildArgs(prompt), validatedRequest);
	}

	private renderPrompt(request: AgentAdapterRunRequest): string {
		const prompt = renderAgentPrompt(request);
		if (!request.sessionId) {
			return prompt;
		}
		return [
			`Previous GitHub Copilot session id: ${request.sessionId}`,
			"Continue the task using this session id as context.",
			"",
			prompt,
		].join("\n");
	}

	private buildArgs(prompt: string): string[] {
		const args = ["-p", prompt];
		if (this.config.githubCopilot?.allowAllTools) {
			args.push("--allow-all-tools");
		}
		for (const pattern of this.config.githubCopilot?.allowTools ?? []) {
			args.push("--allow-tool", pattern);
		}
		for (const pattern of this.config.githubCopilot?.denyTools ?? []) {
			args.push("--deny-tool", pattern);
		}
		return args;
	}

	private async runGitHubCopilot(
		args: string[],
		request: AgentAdapterRunRequest,
	): Promise<AgentResult> {
		const binary = this.config.githubCopilot?.binary ?? "copilot";
		const cwd = this.config.executionPath;
		const result = await runCommand(binary, args, {
			cwd,
			env: this.buildEnv(),
			streamStdout:
				this.config.githubCopilot?.streamLogs ?? this.config.codex.streamLogs,
			streamStderr:
				this.config.githubCopilot?.streamLogs ?? this.config.codex.streamLogs,
			stdinMode: "ignore",
			onStdout: (text) => emitStreamEvent(request, "stdout", text),
			onStderr: (text) => emitStreamEvent(request, "stderr", text),
		}).catch((error) => {
			throw mapGitHubCopilotError(
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
			throw mapGitHubCopilotError(binary, args, result, { cwd, request });
		}

		return {
			finalMessage: extractFinalMessage(result.stdout),
			stdout: result.stdout,
			stderr: result.stderr,
			traceId: request.traceId,
			backend: "github-copilot",
		};
	}

	private buildEnv(): Record<string, string> | undefined {
		const env: Record<string, string> = {};
		const model = this.config.githubCopilot?.model?.trim();
		if (model && model.toLowerCase() !== "auto") env.COPILOT_MODEL = model;
		const copilotHome = this.config.githubCopilot?.copilotHome?.trim();
		if (copilotHome) env.COPILOT_HOME = copilotHome;
		const githubToken = this.config.githubCopilot?.githubToken?.trim();
		if (githubToken) env.COPILOT_GITHUB_TOKEN = githubToken;
		return Object.keys(env).length ? env : undefined;
	}
}
