export function resolveChatRoomSidebarWorkspaceName(
	workspaceName: string | null | undefined,
): string {
	const trimmedName = workspaceName?.trim() ?? "";
	return trimmedName.length > 0 ? trimmedName : "Workspace";
}
