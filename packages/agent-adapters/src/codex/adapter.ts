import { mkdir } from "node:fs/promises";
import path from "node:path";
import { AgentAdapterError } from "../adapter-error";
import { renderAgentPrompt } from "../request-prompt";
import { runCommand } from "../shell";
import { emitStreamEvent } from "../streaming";
import type {
	AgentAdapter,
	AgentAdapterRunRequest,
	AgentAdapterRuntimeConfig,
	AgentResult,
	CodexReasoningEffort,
} from "../types/agent-adapter.types";
import {
	validateAgentAdapterRunRequest,
	validateAgentAdapterRuntimeConfig,
} from "../validation";
import { buildCodexConfigOverrides } from "./config-overrides";
import { buildCodexRuntimeInvocation } from "./docker";
import { extractSessionId, extractUsage } from "./output";
import { readOutputFile } from "./output-file";
import { resolveCodexStageConfig } from "./stage-config";

export { extractSessionId, extractUsage } from "./output";

export class CodexAdapter implements AgentAdapter {
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
		const stage = resolveCodexStageConfig(this.config, validatedRequest.role);
		const outputFile = await this.nextOutputFile();
		const prompt = renderAgentPrompt(validatedRequest);
		const args = validatedRequest.sessionId
			? this.buildResumeArgs(
					validatedRequest,
					prompt,
					outputFile,
					stage.model,
					stage.reasoningEffort,
					stage.fastModeEnabled,
				)
			: this.buildExecArgs(
					validatedRequest,
					prompt,
					outputFile,
					stage.model,
					stage.reasoningEffort,
					stage.fastModeEnabled,
				);
		return this.runCodex(args, validatedRequest);
	}

	private buildExecArgs(
		request: AgentAdapterRunRequest,
		prompt: string,
		outputFile: string,
		modelOverride?: string,
		reasoningEffortOverride?: CodexReasoningEffort,
		fastModeEnabled?: boolean,
	): string[] {
		const args = [
			"exec",
			"--json",
			"--skip-git-repo-check",
			"--cd",
			this.config.executionPath,
			"--output-last-message",
			outputFile,
		];
		const model = modelOverride ?? this.config.codex.model;
		if (model) {
			args.push("--model", model);
		}
		if (this.config.codex.sandbox) {
			args.push("--sandbox", this.config.codex.sandbox);
		}
		this.appendConfigArgs(
			args,
			request,
			reasoningEffortOverride,
			fastModeEnabled,
		);
		args.push(prompt);
		return args;
	}

	private buildResumeArgs(
		request: AgentAdapterRunRequest,
		prompt: string,
		outputFile: string,
		modelOverride?: string,
		reasoningEffortOverride?: CodexReasoningEffort,
		fastModeEnabled?: boolean,
	): string[] {
		const args = [
			"exec",
			"resume",
			"--json",
			"--skip-git-repo-check",
			"--output-last-message",
			outputFile,
		];
		const model = modelOverride ?? this.config.codex.model;
		if (model) {
			args.push("--model", model);
		}
		this.appendConfigArgs(
			args,
			request,
			reasoningEffortOverride,
			fastModeEnabled,
		);
		args.push(request.sessionId ?? "", prompt);
		return args;
	}

	private async runCodex(
		args: string[],
		request: AgentAdapterRunRequest,
	): Promise<AgentResult> {
		const invocation = buildCodexRuntimeInvocation(this.config, args);
		const result = await runCommand(invocation.command, invocation.args, {
			cwd: invocation.cwd,
			env: invocation.env,
			streamStdout: this.config.codex.streamLogs,
			streamStderr: this.config.codex.streamLogs,
			stdinMode: "ignore",
			onStdout: (text) => emitStreamEvent(request, "stdout", text),
			onStderr: (text) => emitStreamEvent(request, "stderr", text),
		}).catch((error) => {
			throw this.toError(
				invocation.command,
				invocation.args,
				invocation.cwd,
				request,
				{
					code: 127,
					stdout: "",
					stderr: error instanceof Error ? error.message : String(error),
				},
			);
		});

		if (result.code !== 0) {
			throw this.toError(
				invocation.command,
				invocation.args,
				invocation.cwd,
				request,
				result,
			);
		}
		const sessionId = extractSessionId(result.stdout);
		const finalMessage = await readOutputFile(invocation.hostOutputFile);
		const usage = extractUsage(result.stdout);
		return {
			sessionId,
			finalMessage,
			stdout: result.stdout,
			stderr: result.stderr,
			traceId: request.traceId,
			backend: "codex",
			usage,
		};
	}

	private async nextOutputFile(): Promise<string> {
		const dir = path.resolve(this.config.workspacePath, ".devos", "tmp");
		await mkdir(dir, { recursive: true });
		return path.join(
			dir,
			`codex-output-${Date.now()}-${Math.floor(Math.random() * 10000)}.txt`,
		);
	}

	private appendConfigArgs(
		args: string[],
		request: AgentAdapterRunRequest,
		reasoningEffortOverride?: CodexReasoningEffort,
		fastModeEnabled?: boolean,
	): void {
		for (const override of this.buildConfigOverrides(
			reasoningEffortOverride,
			fastModeEnabled,
			request,
		)) {
			args.push("--config", override);
		}
	}

	private buildConfigOverrides(
		reasoningEffortOverride?: CodexReasoningEffort,
		fastModeEnabled?: boolean,
		request: AgentAdapterRunRequest = { role: "planning", prompt: "" },
	): string[] {
		return buildCodexConfigOverrides(
			this.config,
			request,
			reasoningEffortOverride,
			fastModeEnabled,
		);
	}

	private toError(
		command: string,
		args: string[],
		cwd: string,
		request: AgentAdapterRunRequest,
		result: { code: number; stdout: string; stderr: string },
	): AgentAdapterError {
		return new AgentAdapterError({
			backend: "codex",
			message: `${command} failed with exit code ${result.code}`,
			command,
			args,
			cwd,
			code: result.code,
			stdout: result.stdout,
			stderr: result.stderr,
			traceId: request.traceId,
		});
	}
}
