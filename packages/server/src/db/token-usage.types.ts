import type { tokenUsageTable } from "./token-usage.schema";

export type TokenUsageRow = typeof tokenUsageTable.$inferSelect;
export type NewTokenUsageRow = typeof tokenUsageTable.$inferInsert;
