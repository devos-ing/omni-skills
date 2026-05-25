import type { ChatMessageRow, ChatSessionRow } from "devos-db";
import type { ChatMessageRecord, ChatSessionRecord } from "./types/chat.types";

export function mapSession(session: ChatSessionRow): ChatSessionRecord {
	return {
		...session,
		pendingQuestions: parseStringArray(session.pendingQuestions),
	};
}

export function mapMessage(message: ChatMessageRow): ChatMessageRecord {
	return {
		...message,
		metadata: parseRecord(message.metadata),
	};
}

export function titleFromMessage(content: string): string {
	const normalized = content.replace(/\s+/g, " ").trim();
	return normalized.length > 42 ? `${normalized.slice(0, 39)}...` : normalized;
}

function parseStringArray(value: string | null): string[] {
	if (!value) {
		return [];
	}
	const parsed = JSON.parse(value) as unknown;
	return Array.isArray(parsed) &&
		parsed.every((item) => typeof item === "string")
		? parsed
		: [];
}

function parseRecord(value: string | null): Record<string, unknown> | null {
	if (!value) {
		return null;
	}
	const parsed = JSON.parse(value) as unknown;
	return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
		? (parsed as Record<string, unknown>)
		: null;
}
