import type { ChatSessionRecord, WorkspaceProjectRecord } from "@/lib/api";

export interface ChatRoomSidebarProps {
	activeSessionId: string;
	error: Error | null;
	isCollapsed: boolean;
	isCreating: boolean;
	isLoading: boolean;
	isMobileOpen: boolean;
	projects: WorkspaceProjectRecord[];
	runningSessionIds: Set<string>;
	sessions: ChatSessionRecord[];
	workspaceName: string | null;
	onNewSession: () => void;
	onCloseSidebar: () => void;
	onArchiveSession: (sessionId: string) => void;
	onSearch: () => void;
	onSelectSession: (sessionId: string) => void;
	onToggleCollapsed: () => void;
}

export interface ChatRoomSidebarHeaderProps {
	isCollapsed: boolean;
	workspaceName: string | null;
	onToggleCollapsed: () => void;
}

export interface ChatRoomSessionListProps {
	activeSessionId: string;
	collapsedProjectIds: Set<string>;
	error: Error | null;
	isLoading: boolean;
	pinnedSessions: ChatSessionRecord[];
	projectGroups: ChatSessionProjectGroup[];
	runningSessionIds: Set<string>;
	onArchiveSession: (sessionId: string) => void;
	onPinSession: (sessionId: string) => void;
	onSelectSession: (sessionId: string) => void;
	onToggleProjectGroup: (
		groupId: string,
		isExpanded: boolean,
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

export interface BuildVisibleProjectSessionsInput {
	isExpanded: boolean;
	sessions: ChatSessionRecord[];
}

export interface VisibleProjectSessions {
	hasOverflow: boolean;
	hiddenSessionCount: number;
	sessions: ChatSessionRecord[];
}

export type ProjectSessionListToggleMode = "collapsed" | "expanded";

export interface BuildProjectSessionListToggleModeInput {
	isExpanded: boolean;
	visibleProjectSessions: VisibleProjectSessions;
}

export interface ChatRoomSessionRowProps {
	activeSessionId: string;
	isPinned: boolean;
	isRunning: boolean;
	session: ChatSessionRecord;
	onArchiveSession: (sessionId: string) => void;
	onPinSession: (sessionId: string) => void;
	onSelectSession: (sessionId: string) => void;
	onUnpinSession: (sessionId: string) => void;
}
