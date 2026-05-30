import type {
	AgentReasoningEffort,
	AgentStatus,
} from "./types/repositories.types";

const REASONING_EFFORTS = new Set(["high", "low", "medium", "xhigh"]);

export function parseAgentReasoningEffort(
	value: string | number | Date | null,
): AgentReasoningEffort | null {
	return typeof value === "string" && REASONING_EFFORTS.has(value)
		? (value as AgentReasoningEffort)
		: null;
}

export function parseAgentStatus(
	value: string | number | Date | null,
): AgentStatus {
	return value === "offline" ? "offline" : "online";
}

export function parseStringList(
	value: string | number | Date | null,
): string[] {
	if (typeof value !== "string") {
		return [];
	}
	try {
		const parsed = JSON.parse(value) as unknown;
		return Array.isArray(parsed) &&
			parsed.every((entry) => typeof entry === "string")
			? parsed
			: [];
	} catch {
		return [];
	}
}
