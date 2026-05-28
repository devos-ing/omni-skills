import type { AgentResult } from "../types/agent-adapter.types";

export function extractFinalMessage(output: string): string {
	const messages = parseEvents(output)
		.map(extractMessageFromEvent)
		.filter((message): message is string => Boolean(message?.trim()));
	return messages.at(-1) ?? output.trim();
}

export function extractSessionId(output: string): string | undefined {
	for (const event of parseEvents(output)) {
		const id = readString(event, [
			"session_id",
			"sessionId",
			"sessionID",
			"conversation_id",
			"conversationId",
		]);
		if (id) return id;
		const session = readRecord(event, "session");
		const sessionId = session ? readString(session, ["id"]) : undefined;
		if (sessionId) return sessionId;
	}
	return undefined;
}

export function extractUsage(output: string): AgentResult["usage"] | undefined {
	const usages = parseEvents(output)
		.map((event) => readUsage(event))
		.filter((usage): usage is Record<string, unknown> => Boolean(usage));
	const usage = usages.at(-1);
	if (!usage) return undefined;
	const inputTokens = readNumber(usage, [
		"inputTokens",
		"input_tokens",
		"promptTokens",
		"prompt_tokens",
		"input",
	]);
	const outputTokens = readNumber(usage, [
		"outputTokens",
		"output_tokens",
		"completionTokens",
		"completion_tokens",
		"output",
	]);
	const totalTokens =
		readNumber(usage, ["totalTokens", "total_tokens", "total"]) ??
		(inputTokens !== undefined && outputTokens !== undefined
			? inputTokens + outputTokens
			: undefined);
	return { inputTokens, outputTokens, totalTokens };
}

function parseEvents(output: string): Record<string, unknown>[] {
	const events: Record<string, unknown>[] = [];
	for (const line of output.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		const parsed = parseRecord(trimmed);
		if (parsed) events.push(parsed);
	}
	if (events.length > 0) return events;
	const parsed = parseRecord(output.trim());
	return parsed ? [parsed] : [];
}

function extractMessageFromEvent(
	event: Record<string, unknown>,
): string | undefined {
	const direct = readString(event, ["result", "message", "text", "content"]);
	if (direct) return direct;
	const part = readRecord(event, "part");
	if (part) return readString(part, ["text", "content"]);
	const data = readRecord(event, "data");
	if (data) return readString(data, ["result", "message", "text", "content"]);
	return undefined;
}

function readUsage(
	event: Record<string, unknown>,
): Record<string, unknown> | undefined {
	const usage = readRecord(event, "usage");
	if (usage) return usage;
	const tokens = readRecord(event, "tokens");
	if (tokens) return tokens;
	const part = readRecord(event, "part");
	return part ? readRecord(part, "tokens") : undefined;
}

function parseRecord(value: string): Record<string, unknown> | undefined {
	try {
		const parsed = JSON.parse(value);
		return parsed && typeof parsed === "object" && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: undefined;
	} catch {
		return undefined;
	}
}

function readRecord(
	record: Record<string, unknown>,
	key: string,
): Record<string, unknown> | undefined {
	const value = record[key];
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

function readString(
	record: Record<string, unknown>,
	keys: readonly string[],
): string | undefined {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "string" && value.trim()) return value;
	}
	return undefined;
}

function readNumber(
	record: Record<string, unknown>,
	keys: readonly string[],
): number | undefined {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "number") return value;
	}
	return undefined;
}
