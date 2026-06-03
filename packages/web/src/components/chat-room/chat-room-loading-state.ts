export function shouldShowChatRoomLoadingShell({
	hasSelectedSession,
	isMessagesLoading,
	isRealtimeActive = false,
}: {
	hasSelectedSession: boolean;
	isMessagesLoading: boolean;
	isRealtimeActive?: boolean;
}): boolean {
	return hasSelectedSession && (isMessagesLoading || isRealtimeActive);
}

export function shouldShowMissionProgressSkeleton({
	hasActiveTask,
	isChatRoomLoading,
}: {
	hasActiveTask: boolean;
	isChatRoomLoading: boolean;
}): boolean {
	return isChatRoomLoading && hasActiveTask;
}
