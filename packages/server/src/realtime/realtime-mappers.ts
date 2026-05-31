import type { BoardProjectRow } from "devos-db";
import type { RealtimeProjectRecord } from "./types/realtime-events.types";

export function toRealtimeProjectRecord(
	project: BoardProjectRow,
): RealtimeProjectRecord {
	return {
		id: project.id,
		boardId: project.boardId,
		workspaceId: project.ownerId,
		externalProjectId: project.externalProjectId,
		name: project.name,
		emoji: project.emoji,
		description: project.description,
		repoOwner: project.repoOwner,
		repoName: project.repoName,
		baseBranch: project.baseBranch,
		localFolder: project.localFolder,
		lead: project.lead,
		category: project.category,
		priority: project.priority,
		createdAt: project.createdAt,
		updatedAt: project.updatedAt,
	};
}
