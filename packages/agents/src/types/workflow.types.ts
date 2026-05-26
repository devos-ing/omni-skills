import type { AgentRunResult, Guardrail } from "./agent.types";
import type { SessionStore, TraceRecorder } from "./runtime.types";

export interface WorkflowPhaseOptions {
	title: string;
	description?: string;
	agentNames?: string[];
	guardrails?: Guardrail[];
}

export interface WorkflowOptions {
	name: string;
	description?: string;
	phases?: WorkflowPhaseOptions[];
	phrases?: WorkflowPhaseOptions[];
	agents?: Array<{ name: string }>;
	session?: SessionStore;
	tracing?: TraceRecorder;
}

export interface WorkflowCallResult<TOutput = unknown> {
	phase: string;
	agent: string;
	result: AgentRunResult<TOutput>;
}
