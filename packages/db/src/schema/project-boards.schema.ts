import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const projectBoardsTable = pgTable("project_boards", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	description: text("description"),
	ownerId: text("owner_id").notNull(),
	createdAt: timestamp("created_at", { mode: "string" }).notNull(),
	updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
});
