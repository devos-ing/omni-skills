import type { ChatMissionProgressViewModel } from "./types/chat-mission-progress.types";
import type { ChatStreamLine } from "./types/chat-room.types";
import type { ChatSessionActivitySection } from "./types/chat-session-activity.types";

interface CreateChatSessionActivityInput {
	missionProgress: ChatMissionProgressViewModel | null;
	streamLines: ChatStreamLine[];
}

export function createChatSessionActivitySections(
	_input: CreateChatSessionActivityInput,
): ChatSessionActivitySection[] {
	// Task activity is owned by Task details; Chat renders processing as messages.
	return [];
}
