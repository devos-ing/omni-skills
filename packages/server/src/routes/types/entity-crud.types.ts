import type { AgentRow, SkillRow } from "devos-db";
import type {
	AgentReasoningEffort,
	AgentRecord,
	AgentStatus,
} from "../../types/repositories.types";

export interface AgentCreatePayload {
	id: string;
	name: string;
	description?: string;
	logo?: string;
	runtime?: string;
	backend: string;
	model: string;
	reasoningEffort?: AgentReasoningEffort | null;
	status?: AgentStatus;
	concurrency?: number;
	owner?: string;
	createdAt: string;
	updatedAt?: string;
	skills?: string[];
	recentWork?: string[];
	activity?: string[];
	instructions?: string;
}

export interface AgentUpdatePayload {
	name?: string;
	description?: string;
	logo?: string;
	runtime?: string;
	backend?: string;
	model?: string;
	reasoningEffort?: AgentReasoningEffort | null;
	status?: AgentStatus;
	concurrency?: number;
	owner?: string;
	createdAt?: string;
	updatedAt?: string;
	skills?: string[];
	recentWork?: string[];
	activity?: string[];
	instructions?: string;
}

export interface SkillCreatePayload {
	id: string;
	name: string;
	description: string;
	source: string;
	updatedAt: string;
}

export interface SkillUpdatePayload {
	name?: string;
	description?: string;
	source?: string;
	updatedAt?: string;
}

export interface CrudRouteMatch {
	entity: "agents" | "skills";
	id: string | null;
}

export interface CrudResponseResult {
	status: number;
	body?:
		| AgentRecord
		| SkillRow
		| AgentRecord[]
		| SkillRow[]
		| { error: string };
}
