import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { boardTasksTable } from "./board-tasks.schema";

export const taskExecutionLogsTable = pgTable("task_execution_logs", {
	id: text("id").primaryKey(),
	taskId: text("task_id")
		.notNull()
		.references(() => boardTasksTable.id),
	status: text("status").notNull(),
	startedAt: timestamp("started_at", { mode: "string" }).notNull(),
	finishedAt: timestamp("finished_at", { mode: "string" }),
	log: text("log").notNull(),
});
