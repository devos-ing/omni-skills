import type { ChatSessionRecord, ChatSessionUpdateRequest } from "@/lib/api";

export function isChatSessionUnread(session: ChatSessionRecord): boolean {
	return (
		!session.lastSeenAt ||
		session.updatedAt.localeCompare(session.lastSeenAt) > 0
	);
}

export function resolveChatSessionSeenUpdate(
	session: ChatSessionRecord | null,
): ChatSessionUpdateRequest | null {
	if (!session || !isChatSessionUnread(session)) {
		return null;
	}
	return { lastSeenAt: session.updatedAt };
}

export function resolveSelectedChatSessionSeenUpdate(
	sessions: ChatSessionRecord[],
	sessionId: string,
): {
	requestKey: string;
	sessionId: string;
	update: ChatSessionUpdateRequest;
} | null {
	const session = sessions.find((item) => item.id === sessionId) ?? null;
	const update = resolveChatSessionSeenUpdate(session);
	if (!session || !update) {
		return null;
	}
	return {
		requestKey: `${session.id}:${session.updatedAt}`,
		sessionId: session.id,
		update,
	};
}
