import type { CodexUsageRecord, ResolvedProjectConfig } from "../types";

type UsageStage = CodexUsageRecord["stage"];

export function enrichUsageRecord(
	config: ResolvedProjectConfig,
	stage: UsageStage,
	usage: {
		inputTokens?: number;
		outputTokens?: number;
		totalTokens?: number;
	},
	recordedAt = new Date().toISOString(),
): CodexUsageRecord {
	const model = resolveUsageModel(config, stage);
	return {
		stage,
		agentBackend: config.agent?.backend ?? "codex",
		model,
		inputTokens: usage.inputTokens,
		outputTokens: usage.outputTokens,
		totalTokens: usage.totalTokens,
		estimatedCostMicrousd: estimateUsageCostMicrousd(
			config,
			model,
			usage.inputTokens,
			usage.outputTokens,
		),
		recordedAt,
	};
}

export function estimateUsageCostMicrousd(
	config: ResolvedProjectConfig,
	model: string | undefined,
	inputTokens: number | undefined,
	outputTokens: number | undefined,
): number | undefined {
	if (
		!model ||
		typeof inputTokens !== "number" ||
		typeof outputTokens !== "number"
	) {
		return undefined;
	}
	const pricing = config.usage?.pricing.models[model];
	if (!pricing) {
		return undefined;
	}
	return Math.round(
		inputTokens * pricing.inputUsdPerMillion +
			outputTokens * pricing.outputUsdPerMillion,
	);
}

export function resolveUsageModel(
	config: ResolvedProjectConfig,
	stage: UsageStage,
): string | undefined {
	const fallback = resolveFallbackModel(config);
	if (stage === "brainstorming") {
		return (
			config.codex.models?.brainstorm ?? config.codex.models?.plan ?? fallback
		);
	}
	if (stage === "planning") {
		return config.codex.models?.plan ?? fallback;
	}
	if (stage === "implementing") {
		return config.codex.models?.implement ?? fallback;
	}
	return config.codex.models?.reviewTest ?? fallback;
}

function resolveFallbackModel(
	config: ResolvedProjectConfig,
): string | undefined {
	if (config.agent?.model) return config.agent.model;
	if (config.agent?.backend === "claude-code") return config.claude?.model;
	if (config.agent?.backend === "cursor-agent") return config.cursor?.model;
	if (config.agent?.backend === "opencode") return config.opencode?.model;
	return config.codex.model;
}
