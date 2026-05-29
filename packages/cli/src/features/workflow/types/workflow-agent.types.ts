import type { AgentSkillReference } from "devos-agents";

export type WorkflowAgentRole =
	| "brainstorm"
	| "planning"
	| "implementing"
	| "review-testing"
	| "github-comment";

export interface WorkflowAgentBridgeInput {
	role: WorkflowAgentRole;
	prompt: string;
	sessionId?: string;
	customInstructions?: string;
	skills?: AgentSkillReference[];
	skillsets?: string[];
}
