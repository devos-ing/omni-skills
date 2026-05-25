import type { ServerDatabase } from "devos-db";
import type {
	ChatAddMessageResult,
	ChatMessageRecord,
	ChatSendResult,
	ChatSessionRecord,
} from "../chat";
import {
	type LocalWorkspaceIdentity,
	ensureLocalDefaultProjectWithStatus,
} from "../local-workspace";
import {
	type RealtimeEventPublisher,
	toRealtimeProjectRecord,
} from "../realtime";

export async function ensureRealtimeLocalDefaultProject(
	db: ServerDatabase["db"],
	workspacePath: string,
	workspace: LocalWorkspaceIdentity,
	realtimeEvents?: RealtimeEventPublisher,
) {
	const result = await ensureLocalDefaultProjectWithStatus(
		db,
		workspacePath,
		workspace,
	);
	if (result.status === "created") {
		realtimeEvents?.publish({
			type: "project.created",
			project: toRealtimeProjectRecord(result.project),
		});
	}
	return result.project;
}

export function publishChatSessionEvent(
	realtimeEvents: RealtimeEventPublisher | undefined,
	type: "chat.session.created" | "chat.session.updated",
	session: ChatSessionRecord | null,
): void {
	if (session) {
		realtimeEvents?.publish({ type, session });
	}
}

export function publishChatMessageEvent(
	realtimeEvents: RealtimeEventPublisher | undefined,
	message: ChatMessageRecord | null,
): void {
	if (message) {
		realtimeEvents?.publish({ type: "chat.message.created", message });
	}
}

export function publishChatAppendResult(
	realtimeEvents: RealtimeEventPublisher | undefined,
	result: ChatAddMessageResult | null,
): void {
	if (!result) return;
	publishChatMessageEvent(realtimeEvents, result.message);
	publishChatSessionEvent(
		realtimeEvents,
		"chat.session.updated",
		result.session,
	);
}

export function publishChatSendResult(
	realtimeEvents: RealtimeEventPublisher | undefined,
	result: ChatSendResult | null,
): void {
	if (!result) return;
	for (const message of result.messages) {
		publishChatMessageEvent(realtimeEvents, message);
	}
	publishChatSessionEvent(
		realtimeEvents,
		"chat.session.updated",
		result.session,
	);
}
