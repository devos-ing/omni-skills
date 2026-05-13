import type { jobsTable } from "./jobs.schema";

export type JobRow = typeof jobsTable.$inferSelect;
export type NewJobRow = typeof jobsTable.$inferInsert;
