import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const skillsTable = pgTable("skills", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	description: text("description").notNull(),
	source: text("source").notNull(),
	updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
});
