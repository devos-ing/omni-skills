export interface ChatThinkingStateInput {
	isSending: boolean;
	selectedSessionId: string;
	sendingSessionId?: string;
	streamLineCount: number;
}

export interface ChatPlanningStateInput {
	hasMissionProgress: boolean;
	taskStatus?: string | null;
}

export function shouldShowChatThinkingIndicator({
	isSending,
	selectedSessionId,
	sendingSessionId,
	streamLineCount,
}: ChatThinkingStateInput): boolean {
	return (
		isSending &&
		Boolean(selectedSessionId) &&
		sendingSessionId === selectedSessionId &&
		streamLineCount === 0
	);
}

export function shouldShowChatPlanningIndicator({
	hasMissionProgress,
	taskStatus,
}: ChatPlanningStateInput): boolean {
	if (hasMissionProgress || !taskStatus) return false;
	return isPlanningTaskStatus(taskStatus);
}

function isPlanningTaskStatus(status: string): boolean {
	return ["plan", "planning", "todo"].includes(status.toLowerCase());
}
