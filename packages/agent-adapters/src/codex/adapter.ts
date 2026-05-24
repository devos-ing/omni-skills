import { mkdir } from "node:fs/promises";
import path from "node:path";
import type {
	AgentAdapter,
	AgentAdapterRuntimeConfig,
	AgentResult,
	CodexReasoningEffort,
} from "../agent-adapter.types";
import { assertCommandOk, runCommand } from "../shell";
import { normalizeList, toTomlStringArray } from "./config";
import { buildCodexRuntimeInvocation } from "./docker";
import { extractSessionId, extractUsage } from "./output";
import { readOutputFile } from "./output-file";

export { extractSessionId, extractUsage } from "./output";

export class CodexAdapter implements AgentAdapter {
	constructor(private config: AgentAdapterRuntimeConfig) {}

	async runPlan(prompt: string): Promise<AgentResult> {
		const model = this.config.codex.models?.plan ?? this.config.codex.model;
		const reasoningEffort =
			this.config.codex.reasoningEfforts?.plan ??
			this.config.codex.reasoningEffort;
		const fastModeEnabled = this.config.codex.fastModes?.plan;
		return this.runCodex(
			this.buildExecArgs(
				prompt,
				await this.nextOutputFile(),
				model,
				reasoningEffort,
				fastModeEnabled,
			),
		);
	}

	async runTaskIntake(prompt: string): Promise<AgentResult> {
		return this.runPlan(prompt);
	}

	async resume(sessionId: string, prompt: string): Promise<AgentResult> {
		const model =
			this.config.codex.models?.implement ?? this.config.codex.model;
		const reasoningEffort =
			this.config.codex.reasoningEfforts?.implement ??
			this.config.codex.reasoningEffort;
		const fastModeEnabled = this.config.codex.fastModes?.implement;
		return this.runCodex(
			this.buildResumeArgs(
				sessionId,
				prompt,
				await this.nextOutputFile(),
				model,
				reasoningEffort,
				fastModeEnabled,
			),
		);
	}

	async runReview(prompt: string): Promise<AgentResult> {
		const model =
			this.config.codex.models?.reviewTest ??
			this.config.codex.models?.implement ??
			this.config.codex.model;
		const reasoningEffort =
			this.config.codex.reasoningEfforts?.reviewTest ??
			this.config.codex.reasoningEfforts?.implement ??
			this.config.codex.reasoningEffort;
		const fastModeEnabled =
			this.config.codex.fastModes?.reviewTest ??
			this.config.codex.fastModes?.implement;
		return this.runCodex(
			this.buildExecArgs(
				prompt,
				await this.nextOutputFile(),
				model,
				reasoningEffort,
				fastModeEnabled,
			),
		);
	}

	async runGithubComment(prompt: string): Promise<AgentResult> {
		const model =
			this.config.codex.models?.githubComment ??
			this.config.codex.models?.reviewTest ??
			this.config.codex.models?.implement ??
			this.config.codex.model;
		const reasoningEffort =
			this.config.codex.reasoningEfforts?.githubComment ??
			this.config.codex.reasoningEfforts?.reviewTest ??
			this.config.codex.reasoningEfforts?.implement ??
			this.config.codex.reasoningEffort;
		const fastModeEnabled =
			this.config.codex.fastModes?.githubComment ??
			this.config.codex.fastModes?.reviewTest ??
			this.config.codex.fastModes?.implement;
		return this.runCodex(
			this.buildExecArgs(
				prompt,
				await this.nextOutputFile(),
				model,
				reasoningEffort,
				fastModeEnabled,
			),
		);
	}

	private buildExecArgs(
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
		this.appendConfigArgs(args, reasoningEffortOverride, fastModeEnabled);
		args.push(prompt);
		return args;
	}

	private buildResumeArgs(
		sessionId: string,
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
		this.appendConfigArgs(args, reasoningEffortOverride, fastModeEnabled);
		args.push(sessionId, prompt);
		return args;
	}

	private async runCodex(args: string[]): Promise<AgentResult> {
		const invocation = buildCodexRuntimeInvocation(this.config, args);
		const result = await runCommand(invocation.command, invocation.args, {
			cwd: invocation.cwd,
			env: invocation.env,
			streamStdout: this.config.codex.streamLogs,
			streamStderr: this.config.codex.streamLogs,
			stdinMode: "ignore",
		});

		assertCommandOk(invocation.command, invocation.args, result);
		const sessionId = extractSessionId(result.stdout);
		const finalMessage = await readOutputFile(invocation.hostOutputFile);
		const usage = extractUsage(result.stdout);
		return {
			sessionId,
			finalMessage,
			stdout: result.stdout,
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
		reasoningEffortOverride?: CodexReasoningEffort,
		fastModeEnabled?: boolean,
	): void {
		for (const override of this.buildConfigOverrides(
			reasoningEffortOverride,
			fastModeEnabled,
		)) {
			args.push("--config", override);
		}
	}

	private buildConfigOverrides(
		reasoningEffortOverride?: CodexReasoningEffort,
		fastModeEnabled?: boolean,
	): string[] {
		const overrides: string[] = [];
		const plugins = normalizeList(this.config.codex.plugins);
		const skillsets = normalizeList(this.config.codex.skillsets);
		const mcpServers = this.config.codex.mcpServers ?? [];

		for (const plugin of plugins) {
			const pluginKey = JSON.stringify(plugin);
			overrides.push(`plugins.${pluginKey}.enabled=true`);
		}
		if (skillsets.length > 0) {
			overrides.push(`skillsets=${toTomlStringArray(skillsets)}`);
		}
		if (reasoningEffortOverride) {
			overrides.push(
				`model_reasoning_effort=${JSON.stringify(reasoningEffortOverride)}`,
			);
		}
		if (fastModeEnabled) {
			overrides.push('service_tier="fast"');
			overrides.push("features.fast_mode=true");
		}
		for (const server of mcpServers) {
			const serverKey = JSON.stringify(server.name);
			overrides.push(
				`mcp_servers.${serverKey}.command=${JSON.stringify(server.command)}`,
			);
			overrides.push(
				`mcp_servers.${serverKey}.args=${toTomlStringArray(server.args)}`,
			);
			overrides.push(`mcp_servers.${serverKey}.type="stdio"`);
			for (const [envKey, envValue] of Object.entries(server.env ?? {})) {
				overrides.push(
					`mcp_servers.${serverKey}.env.${envKey}=${JSON.stringify(envValue)}`,
				);
			}
		}
		for (const [rawKey, rawValue] of Object.entries(
			this.config.codex.configOverrides ?? {},
		)) {
			const key = rawKey.trim();
			const value = rawValue.trim();
			if (!key || !value) {
				continue;
			}
			overrides.push(`${key}=${value}`);
		}

		return overrides;
	}
}
