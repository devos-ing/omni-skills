import type { ChatSessionRecord, WorkspaceProjectRecord } from "@/lib/api";

export interface ChatRoomSidebarProps {
	activeSessionId: string;
	isCreating: boolean;
	projects: WorkspaceProjectRecord[];
	sidebarControlId: string;
	sessions: ChatSessionRecord[];
	onNewSession: () => void;
	onCloseSidebar: () => void;
	onSearch: () => void;
	onSelectSession: (sessionId: string) => void;
}

export interface ChatSessionProjectGroup {
	id: string;
	label: string;
	isActive: boolean;
	sessions: ChatSessionRecord[];
}

export interface BuildChatSessionProjectGroupsInput {
	activeSessionId: string;
	projects: WorkspaceProjectRecord[];
	sessions: ChatSessionRecord[];
}
