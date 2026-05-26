import type { ChatSessionRecord, WorkspaceProjectRecord } from "@/lib/api";

export interface ChatRoomSidebarProps {
	activeSessionId: string;
	error: Error | null;
	isCreating: boolean;
	isLoading: boolean;
	projects: WorkspaceProjectRecord[];
	sidebarControlId: string;
	sessions: ChatSessionRecord[];
	onNewSession: () => void;
	onCloseSidebar: () => void;
	onArchiveSession: (sessionId: string) => void;
	onSearch: () => void;
	onSelectSession: (sessionId: string) => void;
}

export interface ChatRoomSessionListProps {
	activeSessionId: string;
	collapsedProjectIds: Set<string>;
	error: Error | null;
	isLoading: boolean;
	pinnedSessions: ChatSessionRecord[];
	projectGroups: ChatSessionProjectGroup[];
	onArchiveSession: (sessionId: string) => void;
	onPinSession: (sessionId: string) => void;
	onSelectSession: (sessionId: string) => void;
	onToggleProjectGroup: (
		groupId: string,
		isActive: boolean,
		firstSessionId: string,
	) => void;
	onUnpinSession: (sessionId: string) => void;
}

export interface ChatSessionProjectGroup {
	id: string;
	label: string;
	isActive: boolean;
	sessions: ChatSessionRecord[];
}

export interface ChatSessionSidebarContent {
	pinnedSessions: ChatSessionRecord[];
	projectGroups: ChatSessionProjectGroup[];
}

export interface BuildChatSessionProjectGroupsInput {
	activeSessionId: string;
	projects: WorkspaceProjectRecord[];
	sessions: ChatSessionRecord[];
}

export interface BuildChatSessionSidebarContentInput
	extends BuildChatSessionProjectGroupsInput {
	pinnedSessionIds: string[];
}

export interface ChatRoomSessionRowProps {
	activeSessionId: string;
	isPinned: boolean;
	session: ChatSessionRecord;
	onArchiveSession: (sessionId: string) => void;
	onPinSession: (sessionId: string) => void;
	onSelectSession: (sessionId: string) => void;
	onUnpinSession: (sessionId: string) => void;
}
