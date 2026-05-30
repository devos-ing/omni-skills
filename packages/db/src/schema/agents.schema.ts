import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const agentsTable = pgTable("agents", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	description: text("description").notNull(),
	logo: text("logo").notNull(),
	runtime: text("runtime").notNull(),
	backend: text("backend").notNull(),
	model: text("model").notNull(),
	reasoningEffort: text("reasoning_effort"),
	status: text("status").notNull().default("online"),
	concurrency: integer("concurrency").notNull(),
	owner: text("owner").notNull(),
	createdAt: timestamp("created_at", { mode: "string" }).notNull(),
	updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
	skills: text("skills").notNull(),
	recentWork: text("recent_work").notNull(),
	activity: text("activity").notNull(),
	instructions: text("instructions").notNull(),
});
