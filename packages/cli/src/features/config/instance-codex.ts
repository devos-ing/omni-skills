import { readFile } from "node:fs/promises";
import { instanceConfigPath } from "./home-paths";
import type {
	CodexReasoningEffort,
	ProjectRuntimeConfig,
} from "./types/runtime.types";

type CodexModels = NonNullable<ProjectRuntimeConfig["codex"]["models"]>;
type CodexReasoningEfforts = NonNullable<
	ProjectRuntimeConfig["codex"]["reasoningEfforts"]
>;

export interface InstanceCodexConfig {
	models?: CodexModels;
	reasoningEfforts?: CodexReasoningEfforts;
}

const MODEL_STAGES = [
	"brainstorm",
	"plan",
	"implement",
	"reviewTest",
	"githubComment",
] as const;

export async function loadInstanceCodexConfig(
	readText: (
		targetPath: string,
		encoding: BufferEncoding,
	) => Promise<string> = readFile,
): Promise<InstanceCodexConfig | undefined> {
	let content: string;
	try {
		content = await readText(instanceConfigPath(), "utf8");
	} catch {
		return undefined;
	}

	try {
		const parsed = JSON.parse(content) as unknown;
		if (!isRecord(parsed) || !isRecord(parsed.codex)) return undefined;
		return normalizeCodexConfig(parsed.codex);
	} catch {
		return undefined;
	}
}

function normalizeCodexConfig(
	value: Record<string, unknown>,
): InstanceCodexConfig {
	const models = normalizeStringMap(value.models);
	const reasoningEfforts = normalizeReasoningMap(value.reasoningEfforts);
	return {
		...(models ? { models } : {}),
		...(reasoningEfforts ? { reasoningEfforts } : {}),
	};
}

function normalizeStringMap(value: unknown): CodexModels | undefined {
	if (!isRecord(value)) return undefined;
	const entries = MODEL_STAGES.flatMap((stage) => {
		const entry = value[stage];
		return typeof entry === "string" && entry.trim()
			? [[stage, entry.trim()] as const]
			: [];
	});
	return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function normalizeReasoningMap(
	value: unknown,
): CodexReasoningEfforts | undefined {
	if (!isRecord(value)) return undefined;
	const entries = MODEL_STAGES.flatMap((stage) => {
		const entry = value[stage];
		return isReasoningEffort(entry) ? [[stage, entry] as const] : [];
	});
	return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function isReasoningEffort(value: unknown): value is CodexReasoningEffort {
	return (
		value === "low" ||
		value === "medium" ||
		value === "high" ||
		value === "xhigh"
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
