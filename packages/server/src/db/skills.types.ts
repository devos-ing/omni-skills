import type { skillsTable } from "./skills.schema";

export type SkillRow = typeof skillsTable.$inferSelect;
export type NewSkillRow = typeof skillsTable.$inferInsert;
