import type { AgentRow, SkillRow } from "devos-db";
import type { AgentRecord } from "../repositories.types";
import type {
	AgentCreatePayload,
	AgentUpdatePayload,
	SkillCreatePayload,
	SkillUpdatePayload,
} from "./entity-crud.types";

export interface EntityCrudRepository {
	listAgents(): Promise<AgentRow[]>;
	getAgent(id: string): Promise<AgentRow | null>;
	createAgent(input: AgentRow): Promise<AgentRow>;
	updateAgent(id: string, input: Partial<AgentRow>): Promise<AgentRow | null>;
	deleteAgent(id: string): Promise<{ id: string } | null>;
	listSkills(): Promise<SkillRow[]>;
	getSkill(id: string): Promise<SkillRow | null>;
	createSkill(input: SkillCreatePayload): Promise<SkillRow>;
	updateSkill(id: string, input: SkillUpdatePayload): Promise<SkillRow | null>;
	deleteSkill(id: string): Promise<{ id: string } | null>;
}

export type EntityCrudResult<T> =
	| { status: "ok"; value: T }
	| { status: "deleted" }
	| { status: "not_found" };

export interface EntityCrudService {
	listAgents(): Promise<EntityCrudResult<AgentRecord[]>>;
	getAgent(id: string): Promise<EntityCrudResult<AgentRecord>>;
	createAgent(
		input: AgentCreatePayload,
	): Promise<EntityCrudResult<AgentRecord>>;
	updateAgent(
		id: string,
		input: AgentUpdatePayload,
	): Promise<EntityCrudResult<AgentRecord>>;
	deleteAgent(id: string): Promise<EntityCrudResult<never>>;
	listSkills(): Promise<EntityCrudResult<SkillRow[]>>;
	getSkill(id: string): Promise<EntityCrudResult<SkillRow>>;
	createSkill(input: SkillCreatePayload): Promise<EntityCrudResult<SkillRow>>;
	updateSkill(
		id: string,
		input: SkillUpdatePayload,
	): Promise<EntityCrudResult<SkillRow>>;
	deleteSkill(id: string): Promise<EntityCrudResult<never>>;
}
