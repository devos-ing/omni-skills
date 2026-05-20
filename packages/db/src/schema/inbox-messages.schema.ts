import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { agentsTable } from "./agents.schema";
import { boardTasksTable } from "./board-tasks.schema";

export const inboxMessagesTable = pgTable(
	"inbox_messages",
	{
		id: text("id").primaryKey(),
		workspaceId: text("workspace_id").notNull(),
		userId: text("user_id").notNull(),
		runId: text("run_id").notNull(),
		source: text("source").notNull(),
		kind: text("kind").notNull(),
		body: text("body").notNull(),
		taskId: text("task_id").references(() => boardTasksTable.id),
		agentId: text("agent_id").references(() => agentsTable.id),
		metadata: text("metadata"),
		createdAt: timestamp("created_at", { mode: "string" }).notNull(),
	},
	(table) => ({
		scopeCreatedAtIndex: index("inbox_messages_scope_created_at_idx").on(
			table.workspaceId,
			table.userId,
			table.runId,
			table.createdAt,
		),
	}),
);
