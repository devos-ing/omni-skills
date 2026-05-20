import path from "node:path";
import {
	boardProjectsTable,
	initializeServerDatabase,
	projectBoardsTable,
} from "devos-db";
import { SERVER_DB_DIR, SQLITE_ENV_DIR } from "../config/constants";
import type { SetupDraft } from "./setup.types";

const LOCAL_BOARD_ID = "local-board";
const LOCAL_OWNER_ID = "local";

export async function saveSetupProjectMetadata(
	cwd: string,
	draft: SetupDraft,
): Promise<void> {
	const database = await initializeServerDatabase(
		resolveSetupDatabasePath(cwd),
	);
	const now = new Date().toISOString();
	try {
		await database.db
			.insert(projectBoardsTable)
			.values({
				id: LOCAL_BOARD_ID,
				name: "Local Projects",
				description: "Projects configured by local setup",
				ownerId: LOCAL_OWNER_ID,
				createdAt: now,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: projectBoardsTable.id,
				set: { updatedAt: now },
			});
		await database.db
			.insert(boardProjectsTable)
			.values({
				id: draft.projectId,
				boardId: LOCAL_BOARD_ID,
				externalProjectId: draft.projectId,
				name: draft.projectName,
				description: draft.projectDescription || null,
				repoOwner: draft.repoOwner || null,
				repoName: draft.repoName || null,
				baseBranch: draft.baseBranch || null,
				localFolder: draft.executionPath,
				lead: draft.lead || null,
				category: draft.category || null,
				priority: draft.priority,
				ownerId: LOCAL_OWNER_ID,
				createdAt: now,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: boardProjectsTable.id,
				set: {
					externalProjectId: draft.projectId,
					name: draft.projectName,
					description: draft.projectDescription || null,
					repoOwner: draft.repoOwner || null,
					repoName: draft.repoName || null,
					baseBranch: draft.baseBranch || null,
					localFolder: draft.executionPath,
					lead: draft.lead || null,
					category: draft.category || null,
					priority: draft.priority,
					updatedAt: now,
				},
			});
	} finally {
		await database.close();
	}
}

function resolveSetupDatabasePath(cwd: string): string {
	return path.resolve(
		process.env.PIV_SERVER_DATABASE_PATH ||
			path.join(cwd, SQLITE_ENV_DIR, SERVER_DB_DIR),
	);
}
