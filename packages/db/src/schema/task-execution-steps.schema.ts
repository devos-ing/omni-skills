import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { taskExecutionLogsTable } from "./task-execution-logs.schema";

export const taskExecutionStepsTable = pgTable("task_execution_steps", {
	id: text("id").primaryKey(),
	executionLogId: text("execution_log_id")
		.notNull()
		.references(() => taskExecutionLogsTable.id),
	stepNumber: integer("step_number").notNull(),
	action: text("action").notNull(),
	status: text("status").notNull(),
	detail: text("detail"),
	recordedAt: timestamp("recorded_at", { mode: "string" }).notNull(),
});
