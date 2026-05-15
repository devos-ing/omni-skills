import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { boardProjectsTable } from "./board-projects.schema";

export const boardTasksTable = pgTable("board_tasks", {
	id: text("id").primaryKey(),
	projectId: text("project_id")
		.notNull()
		.references(() => boardProjectsTable.id),
	title: text("title").notNull(),
	content: text("content").notNull(),
	priority: integer("priority").notNull(),
	status: text("status").notNull(),
	dueDate: timestamp("due_date", { mode: "string" }),
	creatorId: text("creator_id").notNull(),
	linkedPr: text("linked_pr"),
	linearIssueId: text("linear_issue_id"),
	linearIdentifier: text("linear_identifier"),
	linearUrl: text("linear_url"),
	createdAt: timestamp("created_at", { mode: "string" }).notNull(),
	updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
});
