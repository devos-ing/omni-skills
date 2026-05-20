import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const pollingStatusTable = pgTable(
	"polling_status",
	{
		id: text("id").primaryKey(),
		sourceType: text("source_type").notNull(),
		sourceId: text("source_id").notNull(),
		projectId: text("project_id"),
		state: text("state").notNull(),
		intervalMs: integer("interval_ms").notNull(),
		lastStartedAt: timestamp("last_started_at", { mode: "string" }),
		lastFinishedAt: timestamp("last_finished_at", { mode: "string" }),
		lastSuccessAt: timestamp("last_success_at", { mode: "string" }),
		lastErrorAt: timestamp("last_error_at", { mode: "string" }),
		lastIssueCount: integer("last_issue_count").notNull(),
		lastStaleRetryCount: integer("last_stale_retry_count").notNull(),
		lastReadyTaskCount: integer("last_ready_task_count").notNull(),
		lastDispatchCount: integer("last_dispatch_count").notNull(),
		consecutiveFailures: integer("consecutive_failures").notNull(),
		lastError: text("last_error"),
		updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
	},
	(table) => ({
		sourceIndex: index("polling_status_source_idx").on(
			table.sourceType,
			table.sourceId,
		),
	}),
);
