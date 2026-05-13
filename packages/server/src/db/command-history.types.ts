import type { commandHistoryTable } from "./command-history.schema";

export type CommandHistoryRow = typeof commandHistoryTable.$inferSelect;
export type NewCommandHistoryRow = typeof commandHistoryTable.$inferInsert;
