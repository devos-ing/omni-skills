import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { boardProjectsTable } from "./board-projects.schema";
import { boardTasksTable } from "./board-tasks.schema";

export const chatSessionsTable = pgTable("chat_sessions", {
	id: text("id").primaryKey(),
	workspaceId: text("workspace_id").notNull(),
	projectId: text("project_id").references(() => boardProjectsTable.id, {
		onDelete: "set null",
	}),
	taskId: text("task_id").references(() => boardTasksTable.id, {
		onDelete: "set null",
	}),
	title: text("title").notNull(),
	pendingRequest: text("pending_request"),
	pendingQuestions: text("pending_questions"),
	createdAt: timestamp("created_at", { mode: "string" }).notNull(),
	updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
});
