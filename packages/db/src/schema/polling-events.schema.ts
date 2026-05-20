import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const pollingEventsTable = pgTable(
	"polling_events",
	{
		id: text("id").primaryKey(),
		pollerId: text("poller_id").notNull(),
		sourceType: text("source_type").notNull(),
		sourceId: text("source_id").notNull(),
		projectId: text("project_id"),
		level: text("level").notNull(),
		eventType: text("event_type").notNull(),
		message: text("message").notNull(),
		metadata: text("metadata").notNull(),
		createdAt: timestamp("created_at", { mode: "string" }).notNull(),
	},
	(table) => ({
		pollerCreatedIndex: index("polling_events_poller_created_idx").on(
			table.pollerId,
			table.createdAt,
		),
	}),
);
