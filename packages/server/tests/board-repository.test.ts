import { afterEach, describe, expect, it } from "bun:test";
import { REQUIRED_BOARD_STATUSES, createBoardRepository } from "../src/board";
import {
	type NewBoardProjectRow,
	type NewBoardTaskRow,
	type NewProjectBoardRow,
	boardProjectsTable,
	boardTasksTable,
	projectBoardsTable,
} from "../src/db";
import {
	type DrizzleServerTestDatabase,
	createDrizzleServerTestDatabase,
} from "./server-db-test-helpers";

let testDatabase: DrizzleServerTestDatabase | undefined;

afterEach(async () => {
	if (testDatabase) {
		await testDatabase.cleanup();
		testDatabase = undefined;
	}
});

describe("board repository", () => {
	it("lists only projects owned by the requested workspace", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const { db } = testDatabase;
		const repo = createBoardRepository(db);

		await seedWorkspaceProject({
			db,
			workspaceId: "workspace-1",
			boardId: "board-1",
			projectId: "project-1",
		});
		await seedWorkspaceProject({
			db,
			workspaceId: "workspace-2",
			boardId: "board-2",
			projectId: "project-2",
		});

		const projects = await repo.listWorkspaceProjects("workspace-1");
		expect(projects).toHaveLength(1);
		expect(projects[0]?.id).toBe("project-1");
		expect(projects[0]?.workspaceId).toBe("workspace-1");
	});

	it("returns board grouped by required statuses with empty columns", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const { db } = testDatabase;
		const repo = createBoardRepository(db);

		await seedWorkspaceProject({
			db,
			workspaceId: "workspace-1",
			boardId: "board-1",
			projectId: "project-1",
		});
		await db.insert(boardTasksTable).values([
			buildTask({
				id: "task-1",
				projectId: "project-1",
				status: "planning",
				createdAt: "2026-05-14 00:02:00",
				linearIdentifier: "ROY-233",
			}),
			buildTask({
				id: "task-2",
				projectId: "project-1",
				status: "reviewing",
				createdAt: "2026-05-14 00:03:00",
			}),
			buildTask({
				id: "task-3",
				projectId: "project-1",
				status: "unknown_status",
				createdAt: "2026-05-14 00:04:00",
			}),
		]);

		const board = await repo.getWorkspaceProjectBoard(
			"workspace-1",
			"project-1",
		);
		expect(board).not.toBeNull();
		expect(board?.statusColumns.map((column) => column.status)).toEqual([
			...REQUIRED_BOARD_STATUSES,
		]);
		expect(
			board?.statusColumns.find((column) => column.status === "planning")?.tasks
				.length,
		).toBe(1);
		expect(
			board?.statusColumns.find((column) => column.status === "reviewing")
				?.tasks.length,
		).toBe(1);
		expect(
			board?.statusColumns.find((column) => column.status === "testing")?.tasks
				.length,
		).toBe(0);
		expect(
			board?.statusColumns.find((column) => column.status === "planning")
				?.tasks[0]?.linearIdentifier,
		).toBe("ROY-233");
	});

	it("returns null for workspace/project mismatch and unknown projects", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const { db } = testDatabase;
		const repo = createBoardRepository(db);

		await seedWorkspaceProject({
			db,
			workspaceId: "workspace-1",
			boardId: "board-1",
			projectId: "project-1",
		});

		expect(
			await repo.getWorkspaceProjectBoard("workspace-2", "project-1"),
		).toBeNull();
		expect(
			await repo.getWorkspaceProjectBoard("workspace-1", "project-missing"),
		).toBeNull();
	});
});

async function seedWorkspaceProject(input: {
	db: DrizzleServerTestDatabase["db"];
	workspaceId: string;
	boardId: string;
	projectId: string;
}): Promise<void> {
	const board: NewProjectBoardRow = {
		id: input.boardId,
		name: `Board ${input.boardId}`,
		description: null,
		ownerId: input.workspaceId,
		createdAt: "2026-05-14 00:00:00",
		updatedAt: "2026-05-14 00:00:00",
	};
	const project: NewBoardProjectRow = {
		id: input.projectId,
		boardId: input.boardId,
		externalProjectId: null,
		name: `Project ${input.projectId}`,
		description: null,
		ownerId: input.workspaceId,
		createdAt: "2026-05-14 00:01:00",
		updatedAt: "2026-05-14 00:01:00",
	};
	await input.db.insert(projectBoardsTable).values(board);
	await input.db.insert(boardProjectsTable).values(project);
}

function buildTask(input: {
	id: string;
	projectId: string;
	status: string;
	createdAt: string;
	linearIdentifier?: string;
}): NewBoardTaskRow {
	return {
		id: input.id,
		taskKey:
			input.id === "task-1"
				? "TASK-000001"
				: input.id === "task-2"
					? "TASK-000002"
					: "TASK-000003",
		projectId: input.projectId,
		title: `Task ${input.id}`,
		content: "Task content",
		priority: 1,
		status: input.status,
		dueDate: null,
		creatorId: "user-1",
		linkedPr: null,
		linearIssueId: input.linearIdentifier ? "lin-1" : null,
		linearIdentifier: input.linearIdentifier ?? null,
		linearUrl: input.linearIdentifier
			? "https://linear.app/roy/issue/ROY-233/task"
			: null,
		createdAt: input.createdAt,
		updatedAt: input.createdAt,
	};
}
