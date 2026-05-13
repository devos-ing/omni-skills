import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const commandHistoryTable = pgTable("command_history", {
	id: text("id").primaryKey(),
	command: text("command").notNull(),
	exitCode: integer("exit_code").notNull(),
	executedAt: timestamp("executed_at", { mode: "string" }).notNull(),
});
