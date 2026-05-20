import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { boardTasksTable } from "./board-tasks.schema";

export const taskPullRequestsTable = pgTable(
	"task_pull_requests",
	{
		id: text("id").primaryKey(),
		taskId: text("task_id")
			.notNull()
			.references(() => boardTasksTable.id),
		repository: text("repository").notNull(),
		prNumber: text("pr_number").notNull(),
		prUrl: text("pr_url"),
		createdAt: timestamp("created_at", { mode: "string" }).notNull(),
	},
	(table) => ({
		taskPrUnique: uniqueIndex("task_pull_requests_task_repo_pr_unique").on(
			table.taskId,
			table.repository,
			table.prNumber,
		),
	}),
);
