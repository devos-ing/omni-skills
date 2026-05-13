import type { agentsTable } from "./agents.schema";

export type AgentRow = typeof agentsTable.$inferSelect;
export type NewAgentRow = typeof agentsTable.$inferInsert;
