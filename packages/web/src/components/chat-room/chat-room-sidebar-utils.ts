import type {
	BuildChatSessionProjectGroupsInput,
	ChatSessionProjectGroup,
} from "./types/chat-room-sidebar.types";

const UNASSIGNED_GROUP_ID = "unassigned";
const UNASSIGNED_GROUP_LABEL = "Unassigned";

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
