import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const tokenUsageTable = pgTable("token_usage", {
	id: text("id").primaryKey(),
	runId: text("run_id").notNull(),
	stage: text("stage").notNull(),
	inputTokens: integer("input_tokens").notNull(),
	outputTokens: integer("output_tokens").notNull(),
	totalTokens: integer("total_tokens").notNull(),
	recordedAt: timestamp("recorded_at", { mode: "string" }).notNull(),
});
