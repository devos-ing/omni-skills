export function shouldShowChatRoomLoadingShell({
	hasSelectedSession,
	isMessagesLoading,
}: {
	hasSelectedSession: boolean;
	isMessagesLoading: boolean;
}): boolean {
	return hasSelectedSession && isMessagesLoading;
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
