import type {
	BuildChatSessionProjectGroupsInput,
	BuildChatSessionSidebarContentInput,
	BuildVisibleProjectSessionsInput,
	ChatSessionProjectGroup,
	ChatSessionSidebarContent,
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
