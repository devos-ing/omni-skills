import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { boardTasksTable } from "./board-tasks.schema";
import { taskExecutionLogsTable } from "./task-execution-logs.schema";

export const tokenUsageTable = pgTable("token_usage", {
	id: text("id").primaryKey(),
	runId: text("run_id").notNull(),
	taskId: text("task_id").references(() => boardTasksTable.id),
	taskExecutionLogId: text("task_execution_log_id").references(
		() => taskExecutionLogsTable.id,
	),
	stage: text("stage").notNull(),
	inputTokens: integer("input_tokens").notNull(),
	outputTokens: integer("output_tokens").notNull(),
	totalTokens: integer("total_tokens").notNull(),
	recordedAt: timestamp("recorded_at", { mode: "string" }).notNull(),
});
