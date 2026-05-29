import type { AgentAdapter, AgentResult } from "adapters";
import type { AgentSkillReference } from "devos-agents";
import type {
	ResolvedNotificationConfig,
	ResolvedProjectConfig,
	RunState,
	WorkflowStage,
} from "../../types";
import type { WorkflowAgentRole } from "./workflow-agent.types";
import type { WorkflowTaskClient } from "./workflow.types";

export type BuiltInWorkflowPhaseId =
	| "brainstorm"
	| "plan"
	| "implement"
	| "testing";

export interface WorkflowAgentAssignment {
	name: string;
	role: WorkflowAgentRole;
	required: boolean;
	skills: AgentSkillReference[];
}

export interface WorkflowPhaseDefinition {
	id: BuiltInWorkflowPhaseId;
	title: string;
	stage: WorkflowStage;
	agentAssignments: WorkflowAgentAssignment[];
}

export interface WorkflowMetadata {
	id: string;
	title: string;
	description: string;
	phases: WorkflowPhaseDefinition[];
}

export interface PhaseAgentRunInput {
	config: ResolvedProjectConfig;
	state: RunState;
	phase: WorkflowPhaseDefinition;
	assignment: WorkflowAgentAssignment;
}

export interface PhaseAgentRunResult {
	assignment: WorkflowAgentAssignment;
	result: AgentResult;
}

export type PipelineBeforePhaseResult = "continue" | "skip";

export type PhaseRunResult =
	| {
			status: "fulfilled";
			phase: WorkflowPhaseDefinition;
			agents: PhaseAgentRunResult[];
	  }
	| {
			status: "rejected";
			phase: WorkflowPhaseDefinition;
			error: string;
	  }
	| {
			status: "skipped";
			phase: WorkflowPhaseDefinition;
	  };

export interface PipelineRunResult {
	ok: boolean;
	phaseResults: PhaseRunResult[];
}

export interface BuiltInWorkflowPhaseRunInput {
	phaseId: BuiltInWorkflowPhaseId;
	config: ResolvedProjectConfig;
	agent: AgentAdapter;
	notifications: ResolvedNotificationConfig;
	taskClient: WorkflowTaskClient;
	state: RunState;
}

export type BuiltInWorkflowPhaseHandler = (
	input: BuiltInWorkflowPhaseRunInput,
) => Promise<void>;

export type BuiltInWorkflowPhaseHandlers = Record<
	BuiltInWorkflowPhaseId,
	BuiltInWorkflowPhaseHandler
>;
