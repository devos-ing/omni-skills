"use client";

import { useState } from "react";
import type { ChatRoomMainContentMode } from "./types/chat-room-panel-layout.types";

interface ChatRoomContentTarget {
	mode: ChatRoomMainContentMode;
	sessionId: string;
	taskId: string | null;
}

interface UseChatRoomContentModeStateInput {
	activeTaskId: string | null;
	selectedSessionId: string;
}

interface UseChatRoomContentModeStateResult {
	contentMode: ChatRoomMainContentMode;
	openAction: () => void;
	openMessages: () => void;
	openTaskDetails: () => void;
}

export function useChatRoomContentModeState({
	activeTaskId,
	selectedSessionId,
}: UseChatRoomContentModeStateInput): UseChatRoomContentModeStateResult {
	const [target, setTarget] = useState<ChatRoomContentTarget | null>(null);
	const isSameSession = target?.sessionId === selectedSessionId;
	const contentMode = resolveContentMode(target, activeTaskId, isSameSession);

	function openMessages(): void {
		setTarget(null);
	}

	function openTaskDetails(): void {
		if (!activeTaskId) {
			openMessages();
			return;
		}
		setTarget({
			mode: "taskDetails",
			sessionId: selectedSessionId,
			taskId: activeTaskId,
		});
	}

	function openAction(): void {
		setTarget({
			mode: "action",
			sessionId: selectedSessionId,
			taskId: activeTaskId,
		});
	}

	return { contentMode, openAction, openMessages, openTaskDetails };
}

function resolveContentMode(
	target: ChatRoomContentTarget | null,
	activeTaskId: string | null,
	isSameSession: boolean,
): ChatRoomMainContentMode {
	if (!target || !isSameSession) {
		return "messages";
	}
	if (target.mode === "taskDetails") {
		return activeTaskId && target.taskId === activeTaskId
			? "taskDetails"
			: "messages";
	}
	return target.mode;
}
