import { eq } from "devos-db";
import type { ServerDatabase } from "devos-db";
import { boardProjectsTable, projectBoardsTable } from "devos-db";
import type { NewBoardProjectRow } from "devos-db";
import type { ProjectRepository } from "./project-service.types";

export function createProjectRepository(
	db: ServerDatabase["db"],
): ProjectRepository {
	return {
		async listProjects() {
			return db.select().from(boardProjectsTable);
		},
		async getProject(id) {
			const [project] = await db
				.select()
				.from(boardProjectsTable)
				.where(eq(boardProjectsTable.id, id));
			return project ?? null;
		},
		async boardExists(id) {
			const [board] = await db
				.select({ id: projectBoardsTable.id })
				.from(projectBoardsTable)
				.where(eq(projectBoardsTable.id, id));
			return Boolean(board);
		},
		async createProject(input) {
			const [created] = await db
				.insert(boardProjectsTable)
				.values(input)
				.returning();
			return created;
		},
		async updateProject(id, input: Partial<NewBoardProjectRow>) {
			const [updated] = await db
				.update(boardProjectsTable)
				.set(input)
				.where(eq(boardProjectsTable.id, id))
				.returning();
			return updated ?? null;
		},
		async deleteProject(id) {
			const [deleted] = await db
				.delete(boardProjectsTable)
				.where(eq(boardProjectsTable.id, id))
				.returning();
			return deleted ?? null;
		},
	};
}
