import type { ChatSessionRecord, ProjectBoardTaskRecord } from "@/lib/api";
import type { RealtimeChatStreamBuffer } from "@/lib/realtime/types/realtime-store.types";
import { shouldShowChatPlanningIndicator } from "./chat-thinking-state";
import type { ChatStreamLine } from "./types/chat-room.types";

export function chatStreamLinesForSession(
	streamsByRunId: Record<string, RealtimeChatStreamBuffer>,
	sessionId: string,
): ChatStreamLine[] {
	return Object.values(streamsByRunId)
		.filter((stream) => stream.sessionId === sessionId)
		.sort((left, right) => left.updatedAt.localeCompare(right.updatedAt))
		.flatMap(chatStreamLines);
}

function chatStreamLines(stream: RealtimeChatStreamBuffer): ChatStreamLine[] {
	const text =
		stream.status === "error"
			? (stream.error ?? "Chat stream failed")
			: stream.content;
	const rows = messageRows(text);
	return rows.map((row, index) => ({
		id: rows.length === 1 ? stream.runId : `${stream.runId}:${index}`,
		stream: stream.status === "error" ? "stderr" : "system",
		text: row,
	}));
}

function messageRows(text: string): string[] {
	return text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
}

export function hasLoadingChatStreamForSession(
	streamsByRunId: Record<string, RealtimeChatStreamBuffer>,
	sessionId: string,
): boolean {
	return Object.values(streamsByRunId).some(
		(stream) => stream.sessionId === sessionId && stream.status === "loading",
	);
}

export function activeChatStreamSessionIds(
	streamsByRunId: Record<string, RealtimeChatStreamBuffer>,
	sessions: ChatSessionRecord[] = [],
	tasks: ProjectBoardTaskRecord[] = [],
): Set<string> {
	const sessionIds = new Set<string>();
	for (const stream of Object.values(streamsByRunId)) {
		if (stream.status === "loading" || stream.status === "streaming") {
			sessionIds.add(stream.sessionId);
		}
	}
	const tasksById = new Map(tasks.map((task) => [task.id, task]));
	for (const session of sessions) {
		const taskStatus = session.taskId
			? (tasksById.get(session.taskId)?.status ?? null)
			: null;
		if (
			shouldShowChatPlanningIndicator({
				hasMissionProgress: false,
				taskStatus,
			})
		) {
			sessionIds.add(session.id);
		}
	}
	return sessionIds;
}

export function chatStreamActivityStartedAtForSession(
	streamsByRunId: Record<string, RealtimeChatStreamBuffer>,
	sessionId: string,
): string | null {
	const starts = Object.values(streamsByRunId)
		.filter(
			(stream) =>
				stream.sessionId === sessionId &&
				(stream.status === "loading" || stream.status === "streaming"),
		)
		.map((stream) => stream.startedAt)
		.sort((left, right) => left.localeCompare(right));
	return starts[0] ?? null;
}
