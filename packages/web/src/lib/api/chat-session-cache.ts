import type { ChatSessionRecord } from "./types/chat.types";

export function mergeChatSessions(
	current: ChatSessionRecord[],
	next: ChatSessionRecord[],
): ChatSessionRecord[] {
	const records = new Map(current.map((session) => [session.id, session]));
	for (const session of next) {
		const existing = records.get(session.id);
		if (!existing || shouldReplaceSession(existing, session)) {
			records.set(session.id, session);
		}
	}
	return [...records.values()]
		.filter((session) => !session.archived)
		.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function shouldReplaceSession(
	existing: ChatSessionRecord,
	incoming: ChatSessionRecord,
): boolean {
	const updateOrder = incoming.updatedAt.localeCompare(existing.updatedAt);
	if (updateOrder !== 0) {
		return updateOrder > 0;
	}
	return (
		compareNullableTimestamp(incoming.lastSeenAt, existing.lastSeenAt) >= 0
	);
}

function compareNullableTimestamp(
	left: string | null | undefined,
	right: string | null | undefined,
): number {
	if (!left && !right) {
		return 0;
	}
	if (!left) {
		return -1;
	}
	if (!right) {
		return 1;
	}
	return left.localeCompare(right);
}
