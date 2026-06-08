import {
	CHAT_SESSION_SUBCHANNELS,
	CHAT_SESSION_SUBCHANNEL_LABELS,
	buildChatSessionHref,
} from "./chat-session-subchannels";
import type {
	BuildChatSessionProjectGroupsInput,
	BuildChatSessionSidebarContentInput,
	BuildChatSessionSubchannelRowsInput,
	BuildProjectSessionListToggleModeInput,
	BuildVisibleProjectSessionsInput,
	ChatSessionProjectGroup,
	ChatSessionSidebarContent,
	ChatSessionSubchannelRow,
	ProjectSessionListToggleMode,
	ShouldShowSessionSubchannelsInput,
	VisibleProjectSessions,
} from "./types/chat-room-sidebar.types";

const UNASSIGNED_GROUP_ID = "unassigned";
const UNASSIGNED_GROUP_LABEL = "Unassigned";
const DEFAULT_VISIBLE_PROJECT_SESSION_COUNT = 5;

export function buildChatSessionSidebarContent({
	activeSessionId,
	pinnedSessionIds,
	projects,
	sessions,
}: BuildChatSessionSidebarContentInput): ChatSessionSidebarContent {
	const pinnedIds = new Set(pinnedSessionIds);
	const pinnedSessions = sessions.filter((session) =>
		pinnedIds.has(session.id),
	);
	const unpinnedSessions = sessions.filter(
		(session) => !pinnedIds.has(session.id),
	);

	return {
		pinnedSessions,
		projectGroups: buildChatSessionProjectGroups({
			activeSessionId,
			projects,
			sessions: unpinnedSessions,
		}),
	};
}

export function buildChatSessionProjectGroups({
	activeSessionId,
	projects,
	sessions,
}: BuildChatSessionProjectGroupsInput): ChatSessionProjectGroup[] {
	const projectsById = new Map(
		projects.map((project) => [project.id, project]),
	);
	const groups = new Map<string, ChatSessionProjectGroup>();

	for (const session of sessions) {
		const project = session.projectId
			? projectsById.get(session.projectId)
			: undefined;
		const groupId = project?.id ?? UNASSIGNED_GROUP_ID;
		const group =
			groups.get(groupId) ??
			createSessionProjectGroup(
				groupId,
				project?.name ?? UNASSIGNED_GROUP_LABEL,
			);

		group.sessions.push(session);
		group.isActive = group.isActive || session.id === activeSessionId;
		groups.set(groupId, group);
	}

	return [...groups.values()];
}

export function buildVisibleProjectSessions({
	isExpanded,
	sessions,
}: BuildVisibleProjectSessionsInput): VisibleProjectSessions {
	const hiddenSessionCount = Math.max(
		0,
		sessions.length - DEFAULT_VISIBLE_PROJECT_SESSION_COUNT,
	);
	const hasOverflow = hiddenSessionCount > 0;

	return {
		hasOverflow,
		hiddenSessionCount: isExpanded ? 0 : hiddenSessionCount,
		sessions: isExpanded
			? sessions
			: sessions.slice(0, DEFAULT_VISIBLE_PROJECT_SESSION_COUNT),
	};
}

export function buildProjectSessionListToggleMode(
	input: BuildProjectSessionListToggleModeInput,
): ProjectSessionListToggleMode | null {
	if (!input.visibleProjectSessions.hasOverflow) {
		return null;
	}
	return input.isExpanded ? "expanded" : "collapsed";
}

export function shouldShowSessionSubchannels({
	sessionId,
}: ShouldShowSessionSubchannelsInput): boolean {
	return Boolean(sessionId);
}

export function buildChatSessionSubchannelRows({
	activeSessionId,
	activeSubchannel,
	sessionId,
}: BuildChatSessionSubchannelRowsInput): ChatSessionSubchannelRow[] {
	if (!shouldShowSessionSubchannels({ activeSessionId, sessionId })) {
		return [];
	}
	return CHAT_SESSION_SUBCHANNELS.map((subchannel) => ({
		href: buildChatSessionHref(sessionId, subchannel),
		id: subchannel,
		isActive: sessionId === activeSessionId && subchannel === activeSubchannel,
		label: CHAT_SESSION_SUBCHANNEL_LABELS[subchannel],
	}));
}

function createSessionProjectGroup(
	id: string,
	label: string,
): ChatSessionProjectGroup {
	return {
		id,
		label,
		isActive: false,
		sessions: [],
	};
}
