import type { AgentRow } from "devos-db";
import { z } from "zod";
import type { AgentRecord } from "../repositories.types";
import type {
	AgentCreatePayload,
	AgentUpdatePayload,
} from "./entity-crud.types";

const nonEmptyString = z.string().trim().min(1);
const optionalMetadataString = z.string();
const stringList = z.array(nonEmptyString);

const agentCreateSchema = z.object({
	id: nonEmptyString,
	name: nonEmptyString,
	description: optionalMetadataString.optional(),
	logo: optionalMetadataString.optional(),
	runtime: nonEmptyString.optional(),
	backend: nonEmptyString,
	model: nonEmptyString,
	concurrency: z.number().int().positive().optional(),
	owner: nonEmptyString.optional(),
	createdAt: nonEmptyString,
	updatedAt: nonEmptyString.optional(),
	skills: stringList.optional(),
	recentWork: stringList.optional(),
	activity: stringList.optional(),
	instructions: optionalMetadataString.optional(),
});

const agentUpdateSchema = z.object({
	name: nonEmptyString.optional(),
	description: optionalMetadataString.optional(),
	logo: optionalMetadataString.optional(),
	runtime: nonEmptyString.optional(),
	backend: nonEmptyString.optional(),
	model: nonEmptyString.optional(),
	concurrency: z.number().int().positive().optional(),
	owner: nonEmptyString.optional(),
	createdAt: nonEmptyString.optional(),
	updatedAt: nonEmptyString.optional(),
	skills: stringList.optional(),
	recentWork: stringList.optional(),
	activity: stringList.optional(),
	instructions: optionalMetadataString.optional(),
});

type ValidationResult<T> =
	| { ok: true; value: T }
	| { ok: false; error: string };

export function validateAgentCreatePayload(
	value: unknown,
): ValidationResult<AgentCreatePayload> {
	const result = agentCreateSchema.strict().safeParse(value);
	if (!result.success) {
		return { ok: false, error: formatZodError(result.error) };
	}
	return { ok: true, value: result.data };
}

export function validateAgentUpdatePayload(
	value: unknown,
): ValidationResult<AgentUpdatePayload> {
	const result = agentUpdateSchema.strict().safeParse(value);
	if (!result.success) {
		return { ok: false, error: formatZodError(result.error) };
	}
	if (Object.keys(result.data).length === 0) {
		return {
			ok: false,
			error: "Malformed request: expected at least one field",
		};
	}
	return { ok: true, value: result.data };
}

export function toStoredAgentCreatePayload(
	payload: AgentCreatePayload,
): AgentRow {
	return {
		id: payload.id,
		name: payload.name,
		description: payload.description ?? "",
		logo: payload.logo ?? "",
		runtime: payload.runtime ?? payload.backend,
		backend: payload.backend,
		model: payload.model,
		concurrency: payload.concurrency ?? 1,
		owner: payload.owner ?? "unassigned",
		createdAt: payload.createdAt,
		updatedAt: payload.updatedAt ?? payload.createdAt,
		skills: JSON.stringify(payload.skills ?? []),
		recentWork: JSON.stringify(payload.recentWork ?? []),
		activity: JSON.stringify(payload.activity ?? []),
		instructions: payload.instructions ?? "",
	};
}

export function toStoredAgentUpdatePayload(
	payload: AgentUpdatePayload,
): Partial<AgentRow> {
	return {
		...payload,
		skills:
			payload.skills === undefined ? undefined : JSON.stringify(payload.skills),
		recentWork:
			payload.recentWork === undefined
				? undefined
				: JSON.stringify(payload.recentWork),
		activity:
			payload.activity === undefined
				? undefined
				: JSON.stringify(payload.activity),
	};
}

export function toAgentRecord(row: AgentRow): AgentRecord {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		logo: row.logo,
		runtime: row.runtime,
		backend: row.backend,
		model: row.model,
		concurrency: row.concurrency,
		owner: row.owner,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		skills: parseStringList(row.skills),
		recentWork: parseStringList(row.recentWork),
		activity: parseStringList(row.activity),
		instructions: row.instructions,
	};
}

function parseStringList(value: string): string[] {
	try {
		const parsed = JSON.parse(value) as unknown;
		if (
			Array.isArray(parsed) &&
			parsed.every((entry) => typeof entry === "string")
		) {
			return parsed;
		}
		return [];
	} catch {
		return [];
	}
}

function formatZodError(error: z.ZodError): string {
	const issue = error.issues[0];
	const key = String(issue?.path[0] ?? "field");
	if (issue?.code === "unrecognized_keys") {
		const unknownKey = issue.keys[0];
		return `Malformed request: unknown field '${unknownKey}'`;
	}
	if (
		issue?.code === "invalid_type" &&
		"received" in issue &&
		issue.received === "undefined"
	) {
		return `Malformed request: missing required field '${key}'`;
	}
	if (
		issue?.code === "invalid_type" &&
		typeof issue.message === "string" &&
		issue.message.includes("undefined")
	) {
		return `Malformed request: missing required field '${key}'`;
	}
	return `Malformed request: field '${key}' has invalid value`;
}
