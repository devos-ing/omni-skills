import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const jobsTable = pgTable("jobs", {
	id: text("id").primaryKey(),
	projectId: text("project_id").notNull(),
	issueKey: text("issue_key").notNull(),
	stage: text("stage").notNull(),
	status: text("status").notNull(),
	createdAt: timestamp("created_at", { mode: "string" }).notNull(),
});
