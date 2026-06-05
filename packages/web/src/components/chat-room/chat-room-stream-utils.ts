import type { ChatSessionRecord, ProjectBoardTaskRecord } from "@/lib/api";
import type { RealtimeChatStreamBuffer } from "@/lib/realtime/types/realtime-store.types";
import { shouldShowChatPlanningIndicator } from "./chat-thinking-state";
import type { ChatStreamLine } from "./types/chat-room.types";

const ACTIVE_WORKFLOW_STATES = new Set([
	"brainstorm",
	"plan",
	"implement",
	"testing",
]);

export function chatStreamLinesForSession(
	streamsByRunId: Record<string, RealtimeChatStreamBuffer>,
	sessionId: string,
): ChatStreamLine[] {
	return Object.values(streamsByRunId)
		.filter((stream) => stream.sessionId === sessionId)
		.sort((left, right) => left.updatedAt.localeCompare(right.updatedAt))
		.map(
			(stream): ChatStreamLine => ({
				id: stream.runId,
				stream: stream.status === "error" ? "stderr" : "system",
				text:
					stream.status === "error"
						? (stream.error ?? "Chat stream failed")
						: stream.content,
			}),
		)
		.filter((line) => line.text.trim().length > 0);
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
		if (session.workflowState) {
			if (ACTIVE_WORKFLOW_STATES.has(session.workflowState)) {
				sessionIds.add(session.id);
			}
			continue;
		}
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
