import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { boardTasksTable } from "./board-tasks.schema";

export const taskCommentsTable = pgTable("task_comments", {
	id: text("id").primaryKey(),
	taskId: text("task_id")
		.notNull()
		.references(() => boardTasksTable.id),
	authorId: text("author_id").notNull(),
	authorType: text("author_type").notNull(),
	comment: text("comment").notNull(),
	createdAt: timestamp("created_at", { mode: "string" }).notNull(),
});
