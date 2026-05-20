import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { boardTasksTable } from "./board-tasks.schema";

export const taskAssigneesTable = pgTable(
	"task_assignees",
	{
		id: text("id").primaryKey(),
		taskId: text("task_id")
			.notNull()
			.references(() => boardTasksTable.id),
		assigneeId: text("assignee_id").notNull(),
		assigneeType: text("assignee_type").notNull(),
		createdAt: timestamp("created_at", { mode: "string" }).notNull(),
	},
	(table) => ({
		taskAssigneeUnique: uniqueIndex("task_assignees_task_assignee_unique").on(
			table.taskId,
			table.assigneeId,
			table.assigneeType,
		),
	}),
);
