import { mkdir } from "node:fs/promises";
import path from "node:path";
import { eq } from "devos-db";
import { boardProjectsTable } from "devos-db";
import { projectBoardsTable } from "devos-db";
import type { BoardProjectRow, ServerDatabase } from "devos-db";

export const LOCAL_BOARD_ID = "board-1";
export const LOCAL_WORKSPACE_ID = "owner-1";
export const DEFAULT_PROJECT_ID = "default";
export const DEFAULT_PROJECT_NAME = "Default Project";

export async function ensureLocalProjectBoard(
	db: ServerDatabase["db"],
	now = new Date().toISOString(),
): Promise<void> {
	await db
		.insert(projectBoardsTable)
		.values({
			id: LOCAL_BOARD_ID,
			name: "Local Workspace",
			description: "Projects created from the local web UI",
			ownerId: LOCAL_WORKSPACE_ID,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoNothing();
}

export async function ensureLocalDefaultProject(
	db: ServerDatabase["db"],
	workspacePath: string,
	now = new Date().toISOString(),
): Promise<BoardProjectRow> {
	await ensureLocalProjectBoard(db, now);
	const localFolder = defaultProjectFolder(workspacePath);
	await mkdir(localFolder, { recursive: true });
	const [existing] = await db
		.select()
		.from(boardProjectsTable)
		.where(eq(boardProjectsTable.id, DEFAULT_PROJECT_ID));
	if (existing) {
		if (existing.localFolder === localFolder) {
			return existing;
		}
		const [updated] = await db
			.update(boardProjectsTable)
			.set({ localFolder, updatedAt: now })
			.where(eq(boardProjectsTable.id, DEFAULT_PROJECT_ID))
			.returning();
		return updated ?? existing;
	}
	const [created] = await db
		.insert(boardProjectsTable)
		.values({
			id: DEFAULT_PROJECT_ID,
			boardId: LOCAL_BOARD_ID,
			externalProjectId: null,
			name: DEFAULT_PROJECT_NAME,
			description: "Default project for chat sessions",
			repoOwner: null,
			repoName: null,
			baseBranch: null,
			localFolder,
			lead: null,
			category: "local",
			priority: null,
			ownerId: LOCAL_WORKSPACE_ID,
			createdAt: now,
			updatedAt: now,
		})
		.returning();
	if (!created) {
		throw new Error("Default project creation failed");
	}
	return created;
}

export function defaultProjectFolder(workspacePath: string): string {
	return path.join(workspacePath, ".devos", "projects", DEFAULT_PROJECT_ID);
}
