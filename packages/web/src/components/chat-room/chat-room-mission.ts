"use client";

import type { ChatMessageRecord, ChatSessionRecord } from "@/lib/api";
import { useBoardTaskQuery } from "@/lib/api/queries";

import { useChatMissionProgress } from "./chat-mission-progress-state";
import { findActiveTaskId } from "./chat-task-utils";
import { shouldShowChatPlanningIndicator } from "./chat-thinking-state";
import type { ChatMissionProgressViewModel } from "./types/chat-mission-progress.types";

export function useChatRoomMission(
	session: ChatSessionRecord | null,
	messages: ChatMessageRecord[],
): {
	activeTaskId: string | null;
	isPlanning: boolean;
	missionProgress: ChatMissionProgressViewModel | null;
} {
	const activeTaskId = findActiveTaskId(session, messages);
	const taskQuery = useBoardTaskQuery(activeTaskId ?? "", {
		enabled: Boolean(activeTaskId),
	});
	const missionProgress = useChatMissionProgress(activeTaskId);
	return {
		activeTaskId,
		isPlanning: shouldShowChatPlanningIndicator({
			hasMissionProgress: Boolean(missionProgress),
			taskStatus: taskQuery.data?.status ?? null,
		}),
		missionProgress,
	};
}
