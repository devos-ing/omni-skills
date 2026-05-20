import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { projectBoardsTable } from "./project-boards.schema";

export const boardProjectsTable = pgTable("board_projects", {
	id: text("id").primaryKey(),
	boardId: text("board_id")
		.notNull()
		.references(() => projectBoardsTable.id),
	externalProjectId: text("external_project_id"),
	name: text("name").notNull(),
	description: text("description"),
	ownerId: text("owner_id").notNull(),
	createdAt: timestamp("created_at", { mode: "string" }).notNull(),
	updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
});
