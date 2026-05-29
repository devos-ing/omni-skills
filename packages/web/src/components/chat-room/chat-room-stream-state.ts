import type { RealtimeChatStreamBuffer } from "@/lib/realtime/types/realtime-store.types";
import {
	chatStreamActivityStartedAtForSession,
	chatStreamLinesForSession,
	hasLoadingChatStreamForSession,
} from "./chat-room-stream-utils";
import { shouldShowChatThinkingIndicator } from "./chat-thinking-state";
import type { ChatStreamLine } from "./types/chat-room.types";

export function resolveChatRoomStreamState(
	commandLines: ChatStreamLine[],
	chatStreamsByRunId: Record<string, RealtimeChatStreamBuffer>,
	selectedSessionId: string,
	isSending: boolean,
	sendingSessionId?: string,
): {
	activityStartedAt: string | null;
	isThinking: boolean;
	streamLines: ChatStreamLine[];
} {
	const streamLines = [
		...commandLines,
		...chatStreamLinesForSession(chatStreamsByRunId, selectedSessionId),
	];
	return {
		activityStartedAt: chatStreamActivityStartedAtForSession(
			chatStreamsByRunId,
			selectedSessionId,
		),
		isThinking: shouldShowChatThinkingIndicator({
			hasLoadingStream: hasLoadingChatStreamForSession(
				chatStreamsByRunId,
				selectedSessionId,
			),
			isSending,
			selectedSessionId,
			sendingSessionId,
			streamLineCount: streamLines.length,
		}),
		streamLines,
	};
}
