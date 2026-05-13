import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const agentsTable = pgTable("agents", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	backend: text("backend").notNull(),
	model: text("model").notNull(),
	createdAt: timestamp("created_at", { mode: "string" }).notNull(),
});
