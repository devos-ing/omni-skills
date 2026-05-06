import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { assertCommandOk, runCommand } from "./shell";
import type { ResolvedProjectConfig } from "./types";

export interface CodexResult {
	sessionId?: string;
	finalMessage: string;
	stdout: string;
	usage?: {
		inputTokens?: number;
		outputTokens?: number;
		totalTokens?: number;
	};
}

export function buildCodexExecArgs(
	config: ResolvedProjectConfig,
	prompt: string,
	outputFile: string,
	modelOverride?: string,
): string[] {
	const args = [
		"exec",
		"--json",
		"--skip-git-repo-check",
		"--cd",
		config.executionPath,
		"--output-last-message",
		outputFile,
	];
	const model = modelOverride ?? config.codex.model;
	if (model) {
		args.push("--model", model);
	}
	if (config.codex.sandbox) {
		args.push("--sandbox", config.codex.sandbox);
	}
	args.push(prompt);
	return args;
}

export function buildCodexResumeArgs(
	config: ResolvedProjectConfig,
	sessionId: string,
	prompt: string,
	outputFile: string,
	modelOverride?: string,
): string[] {
	const args = [
		"exec",
		"resume",
		"--json",
		"--skip-git-repo-check",
		"--output-last-message",
		outputFile,
	];
	const model = modelOverride ?? config.codex.model;
	if (model) {
		args.push("--model", model);
	}
	args.push(sessionId, prompt);
	return args;
}

export async function runPlanSession(
	config: ResolvedProjectConfig,
	prompt: string,
): Promise<CodexResult> {
	const model = config.codex.models?.plan ?? config.codex.model;
	return runCodex(
		config,
		buildCodexExecArgs(config, prompt, await nextOutputFile(config), model),
	);
}

export async function runResumeSession(
	config: ResolvedProjectConfig,
	sessionId: string,
	prompt: string,
): Promise<CodexResult> {
	const model = config.codex.models?.implement ?? config.codex.model;
	return runCodex(
		config,
		buildCodexResumeArgs(
			config,
			sessionId,
			prompt,
			await nextOutputFile(config),
			model,
		),
	);
}

export async function runReviewSession(
	config: ResolvedProjectConfig,
	prompt: string,
): Promise<CodexResult> {
	const model =
		config.codex.models?.reviewTest ??
		config.codex.models?.implement ??
		config.codex.model;
	return runCodex(
		config,
		buildCodexExecArgs(config, prompt, await nextOutputFile(config), model),
	);
}

async function runCodex(
	config: ResolvedProjectConfig,
	args: string[],
): Promise<CodexResult> {
	const isDevMode =
		process.env.PIV_DEV_MODE === "1" ||
		process.env.PIV_PRINT_CODEX_LOGS === "1";
	const outputFile = args[args.indexOf("--output-last-message") + 1] ?? "";
	const envOverrides = config.codex.codexHome
		? { CODEX_HOME: config.codex.codexHome }
		: {};
	const result = await runCommand(config.codex.binary, args, {
		cwd: config.executionPath,
		env: envOverrides,
		streamStdout: isDevMode,
		streamStderr: isDevMode,
		stdinMode: "ignore",
	});

	assertCommandOk(config.codex.binary, args, result);
	const sessionId = extractSessionId(result.stdout);
	const finalMessage = await readOutputFile(outputFile);
	const usage = extractUsage(result.stdout);
	return {
		sessionId,
		finalMessage,
		stdout: result.stdout,
		usage,
	};
}

async function nextOutputFile(config: ResolvedProjectConfig): Promise<string> {
	const dir = path.join(config.workspacePath, ".piv-loop", "tmp");
	await mkdir(dir, { recursive: true });
	return path.join(
		dir,
		`codex-output-${Date.now()}-${Math.floor(Math.random() * 10000)}.txt`,
	);
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
): CodexResult["usage"] | undefined {
	const lines = jsonlOutput.split("\n").filter(Boolean);
	let latestUsage: CodexResult["usage"] | undefined;
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

function findUsageObject(value: unknown): CodexResult["usage"] | undefined {
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
): CodexResult["usage"] | undefined {
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
