import type { ChatSessionRecord } from "./types/chat.types";

export function mergeChatSessions(
	current: ChatSessionRecord[],
	next: ChatSessionRecord[],
): ChatSessionRecord[] {
	const records = new Map(current.map((session) => [session.id, session]));
	for (const session of next) {
		const existing = records.get(session.id);
		if (!existing || session.updatedAt.localeCompare(existing.updatedAt) >= 0) {
			records.set(session.id, session);
		}
	}
	return [...records.values()]
		.filter((session) => !session.archived)
		.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}
