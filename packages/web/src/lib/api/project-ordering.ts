import type { WorkspaceProjectRecord } from "./types/client.types";

export function sortWorkspaceProjects(
	projects: WorkspaceProjectRecord[],
): WorkspaceProjectRecord[] {
	return [...projects].sort(compareWorkspaceProjects);
}

function compareWorkspaceProjects(
	left: WorkspaceProjectRecord,
	right: WorkspaceProjectRecord,
): number {
	if (left.isPinned !== right.isPinned) {
		return left.isPinned ? -1 : 1;
	}
	const createdDiff = Date.parse(left.createdAt) - Date.parse(right.createdAt);
	if (createdDiff !== 0 && !Number.isNaN(createdDiff)) {
		return createdDiff;
	}
	return left.id.localeCompare(right.id);
}
