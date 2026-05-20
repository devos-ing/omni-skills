import type { AgentResult } from "../agent-adapter.types";

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
