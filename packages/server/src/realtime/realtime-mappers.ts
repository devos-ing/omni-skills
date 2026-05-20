import type { BoardProjectRow } from "devos-db";
import type { RealtimeProjectRecord } from "./realtime-events.types";

export function toRealtimeProjectRecord(
	project: BoardProjectRow,
): RealtimeProjectRecord {
	return {
		id: project.id,
		boardId: project.boardId,
		workspaceId: project.ownerId,
		externalProjectId: project.externalProjectId,
		name: project.name,
		description: project.description,
		createdAt: project.createdAt,
		updatedAt: project.updatedAt,
	};
}
