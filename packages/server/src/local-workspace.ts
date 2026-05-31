import { mkdir } from "node:fs/promises";
import path from "node:path";
import { eq } from "devos-db";
import { boardProjectsTable } from "devos-db";
import { chatSessionsTable } from "devos-db";
import { projectBoardsTable } from "devos-db";
import type { BoardProjectRow, ServerDatabase } from "devos-db";

export const LOCAL_BOARD_ID = "board-1";
export const LOCAL_WORKSPACE_ID = "owner-1";
export const LOCAL_WORKSPACE_NAME = "Default Workspace";
export const DEFAULT_PROJECT_ID = "default";
export const DEFAULT_PROJECT_NAME = "Default Project";

export interface LocalWorkspaceIdentity {
	id: string;
	name: string;
}

export type LocalDefaultProjectStatus = "created" | "existing" | "updated";

export interface LocalDefaultProjectResult {
	project: BoardProjectRow;
	status: LocalDefaultProjectStatus;
}

export async function ensureLocalProjectBoard(
	db: ServerDatabase["db"],
	workspace: LocalWorkspaceIdentity = defaultLocalWorkspace(),
	now = new Date().toISOString(),
): Promise<void> {
	await adoptLegacyLocalWorkspace(db, workspace, now);
	await db
		.insert(projectBoardsTable)
		.values({
			id: LOCAL_BOARD_ID,
			name: "Local Workspace",
			description: "Projects created from the local web UI",
			ownerId: workspace.id,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoNothing();
}

export async function ensureLocalDefaultProject(
	db: ServerDatabase["db"],
	workspacePath: string,
	workspace: LocalWorkspaceIdentity = defaultLocalWorkspace(),
	now = new Date().toISOString(),
): Promise<BoardProjectRow> {
	return (
		await ensureLocalDefaultProjectWithStatus(db, workspacePath, workspace, now)
	).project;
}

export async function ensureLocalDefaultProjectWithStatus(
	db: ServerDatabase["db"],
	workspacePath: string,
	workspace: LocalWorkspaceIdentity = defaultLocalWorkspace(),
	now = new Date().toISOString(),
): Promise<LocalDefaultProjectResult> {
	await ensureLocalProjectBoard(db, workspace, now);
	const localFolder = defaultProjectFolder(workspacePath);
	await mkdir(localFolder, { recursive: true });
	const [existing] = await db
		.select()
		.from(boardProjectsTable)
		.where(eq(boardProjectsTable.id, DEFAULT_PROJECT_ID));
	if (existing) {
		if (
			existing.localFolder === localFolder &&
			existing.ownerId === workspace.id
		) {
			return { project: existing, status: "existing" };
		}
		const [updated] = await db
			.update(boardProjectsTable)
			.set({ localFolder, ownerId: workspace.id, updatedAt: now })
			.where(eq(boardProjectsTable.id, DEFAULT_PROJECT_ID))
			.returning();
		return { project: updated ?? existing, status: "updated" };
	}
	const [created] = await db
		.insert(boardProjectsTable)
		.values({
			id: DEFAULT_PROJECT_ID,
			boardId: LOCAL_BOARD_ID,
			externalProjectId: null,
			name: DEFAULT_PROJECT_NAME,
			emoji: "🧭",
			description: "Default project for chat sessions",
			repoOwner: null,
			repoName: null,
			baseBranch: null,
			localFolder,
			lead: null,
			category: "local",
			priority: null,
			ownerId: workspace.id,
			createdAt: now,
			updatedAt: now,
		})
		.returning();
	if (!created) {
		throw new Error("Default project creation failed");
	}
	return { project: created, status: "created" };
}

export function defaultProjectFolder(workspacePath: string): string {
	return path.join(workspacePath, ".devos", "projects", DEFAULT_PROJECT_ID);
}

export function defaultLocalWorkspace(): LocalWorkspaceIdentity {
	return {
		id: LOCAL_WORKSPACE_ID,
		name: LOCAL_WORKSPACE_NAME,
	};
}

async function adoptLegacyLocalWorkspace(
	db: ServerDatabase["db"],
	workspace: LocalWorkspaceIdentity,
	now: string,
): Promise<void> {
	if (workspace.id === LOCAL_WORKSPACE_ID) {
		return;
	}
	await db
		.update(projectBoardsTable)
		.set({ ownerId: workspace.id, updatedAt: now })
		.where(eq(projectBoardsTable.id, LOCAL_BOARD_ID));
	await db
		.update(boardProjectsTable)
		.set({ ownerId: workspace.id, updatedAt: now })
		.where(eq(boardProjectsTable.ownerId, LOCAL_WORKSPACE_ID));
	await db
		.update(chatSessionsTable)
		.set({ workspaceId: workspace.id })
		.where(eq(chatSessionsTable.workspaceId, LOCAL_WORKSPACE_ID));
}
