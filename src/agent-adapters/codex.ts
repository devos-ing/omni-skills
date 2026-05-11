import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type {
	CodexReasoningEffort,
	ResolvedProjectConfig,
} from "../core/types";
import { assertCommandOk, runCommand } from "../utils/shell";
import { buildCodexRuntimeInvocation } from "./codex-docker";
import type { AgentAdapter, AgentResult } from "./index";

export class CodexAdapter implements AgentAdapter {
	constructor(private config: ResolvedProjectConfig) {}

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
		const dir = path.join(this.config.workspacePath, ".piv-loop", "tmp");
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

async function readOutputFile(file: string): Promise<string> {
	try {
		return (await readFile(file, "utf8")).trim();
	} catch {
		return "";
	}
}

export function extractSessionId(jsonlOutput: string): string | undefined {
	const lines = jsonlOutput.split("\n").filter(Boolean);
	for (const line of lines) {
		try {
			const parsed = JSON.parse(line) as unknown;
			const id = findStringByKey(parsed, [
				"session_id",
				"sessionId",
				"thread_id",
				"threadId",
				"conversation_id",
				"conversationId",
			]);
			if (id) {
				return id;
			}
		} catch {}
	}
	return undefined;
}

export function extractUsage(
	jsonlOutput: string,
): AgentResult["usage"] | undefined {
	const lines = jsonlOutput.split("\n").filter(Boolean);
	let latestUsage: AgentResult["usage"] | undefined;
	for (const line of lines) {
		try {
			const parsed = JSON.parse(line) as unknown;
			const usage = findUsageObject(parsed);
			if (usage) {
				latestUsage = usage;
			}
		} catch {}
	}
	return latestUsage;
}

function findUsageObject(value: unknown): AgentResult["usage"] | undefined {
	if (!value || typeof value !== "object") {
		return undefined;
	}
	const asRecord = value as Record<string, unknown>;
	const usage = buildUsageFromRecord(asRecord);
	if (usage) {
		return usage;
	}
	for (const nested of Object.values(asRecord)) {
		const found = findUsageObject(nested);
		if (found) {
			return found;
		}
	}
	return undefined;
}

function buildUsageFromRecord(
	record: Record<string, unknown>,
): AgentResult["usage"] | undefined {
	const inputTokens = findNumberByKey(record, [
		"input_tokens",
		"inputTokens",
		"prompt_tokens",
		"promptTokens",
	]);
	const outputTokens = findNumberByKey(record, [
		"output_tokens",
		"outputTokens",
		"completion_tokens",
		"completionTokens",
	]);
	const totalTokens = findNumberByKey(record, ["total_tokens", "totalTokens"]);

	if (
		inputTokens === undefined &&
		outputTokens === undefined &&
		totalTokens === undefined
	) {
		return undefined;
	}

	return {
		inputTokens,
		outputTokens,
		totalTokens:
			totalTokens ??
			(inputTokens !== undefined || outputTokens !== undefined
				? (inputTokens ?? 0) + (outputTokens ?? 0)
				: undefined),
	};
}

function findNumberByKey(
	record: Record<string, unknown>,
	keys: string[],
): number | undefined {
	for (const key of keys) {
		const candidate = record[key];
		if (typeof candidate === "number" && Number.isFinite(candidate)) {
			return candidate;
		}
	}
	return undefined;
}

function findStringByKey(value: unknown, keys: string[]): string | undefined {
	if (!value || typeof value !== "object") {
		return undefined;
	}
	const asRecord = value as Record<string, unknown>;
	for (const key of keys) {
		const candidate = asRecord[key];
		if (typeof candidate === "string" && candidate.length > 0) {
			return candidate;
		}
	}
	for (const nested of Object.values(asRecord)) {
		const id = findStringByKey(nested, keys);
		if (id) {
			return id;
		}
	}
	return undefined;
}

function normalizeList(values: string[] | undefined): string[] {
	if (!values) {
		return [];
	}
	return values.map((value) => value.trim()).filter(Boolean);
}

function toTomlStringArray(values: string[]): string {
	return `[${values.map((value) => JSON.stringify(value)).join(", ")}]`;
}
