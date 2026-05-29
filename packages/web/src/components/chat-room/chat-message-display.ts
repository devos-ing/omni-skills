import type { ChatMessageRecord } from "@/lib/api";

export type ChatMessageDisplay =
	| "assistant-note"
	| "error"
	| "plan"
	| "standard";

export function resolveChatMessageDisplay(
	message: ChatMessageRecord,
): ChatMessageDisplay {
	if (message.kind === "error") {
		return "error";
	}
	if (message.role === "assistant" && isPlanContent(message.content)) {
		return "plan";
	}
	if (message.role === "assistant") {
		return "assistant-note";
	}
	return "standard";
}

export function isPlanContent(content: string): boolean {
	const normalized = content.trim();
	if (!normalized) {
		return false;
	}
	if (/<\/?proposed_plan>/i.test(normalized)) {
		return true;
	}
	const matchedHeadings = countPlanHeadings(normalized);
	if (matchedHeadings >= 2) {
		return true;
	}
	if (!/\bSUCCESS_GOAL\s*:/i.test(normalized)) {
		return false;
	}
	return (
		/\bPLANNING_RESULT\s*:\s*READY\b/i.test(normalized) ||
		/\bCOMPLEXITY\s*:\s*(SIMPLE|COMPLEX)\b/i.test(normalized)
	);
}

function countPlanHeadings(content: string): number {
	const matches = content.matchAll(
		/^(?:#{1,3}\s*)?(?:\*\*)?(title|summary|agent plan|key changes|checkpoints \(steps\)|test plan|assumptions)(?:\*\*)?\s*$/gim,
	);
	return new Set([...matches].map((match) => match[1]?.toLowerCase())).size;
}
