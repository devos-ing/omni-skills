import {
	boardProjectsTable,
	boardTasksTable,
	generateBoardTaskKey,
	initializeServerDatabase,
} from "devos-server/db";
import { eq } from "drizzle-orm";
import type { ResolvedProjectConfig } from "../types";
import type {
	TaskIntakeCreatedTask,
	TaskIntakeTask,
	TaskIntakeTaskCreator,
} from "./task-intake.types";

const DEFAULT_TASK_CREATOR_ID = "member-1";
const DEFAULT_TASK_PRIORITY = 1;
const DEFAULT_TASK_STATUS = "planning";

export function createBoardTaskCreator(
	config: ResolvedProjectConfig,
): TaskIntakeTaskCreator {
	return {
		async createTask(input) {
			return createBoardTask(config, input);
		},
	};
}

async function createBoardTask(
	config: ResolvedProjectConfig,
	input: TaskIntakeTask,
): Promise<TaskIntakeCreatedTask> {
	const database = await initializeServerDatabase(
		config.server.database.databasePath,
	);
	try {
		const project = await resolveBoardProject(database.db, config.id);
		const now = new Date().toISOString();
		const [created] = await database.db
			.insert(boardTasksTable)
			.values({
				id: crypto.randomUUID(),
				taskKey: await generateBoardTaskKey(database.db),
				projectId: project?.id ?? null,
				title: input.title,
				content: input.description,
				priority: DEFAULT_TASK_PRIORITY,
				status: DEFAULT_TASK_STATUS,
				dueDate: null,
				creatorId: project?.ownerId ?? DEFAULT_TASK_CREATOR_ID,
				linkedPr: null,
				linearIssueId: null,
				linearIdentifier: null,
				linearUrl: null,
				createdAt: now,
				updatedAt: now,
			})
			.returning();
		if (!created) {
			throw new Error("Board task was not created");
		}
		return created;
	} finally {
		await database.close();
	}
}

async function resolveBoardProject(
	db: Awaited<ReturnType<typeof initializeServerDatabase>>["db"],
	projectId: string,
): Promise<{ id: string; ownerId: string } | null> {
	const [project] = await db
		.select({ id: boardProjectsTable.id, ownerId: boardProjectsTable.ownerId })
		.from(boardProjectsTable)
		.where(eq(boardProjectsTable.id, projectId));
	return project ?? null;
}
