import { asc, eq } from "drizzle-orm";
import type { ServerDatabase } from "../db";
import { agentsTable, skillsTable } from "../db";
import {
	toAgentRecord,
	toStoredAgentCreatePayload,
	toStoredAgentUpdatePayload,
	validateAgentCreatePayload,
	validateAgentUpdatePayload,
} from "./entity-crud-agent";
import {
	parseJsonBody,
	validateCreatePayload,
	validateUpdatePayload,
} from "./entity-crud-validators";
import type {
	CrudResponseResult,
	CrudRouteMatch,
	SkillCreatePayload,
	SkillUpdatePayload,
} from "./entity-crud.types";

const SKILL_CREATE_FIELDS = [
	"id",
	"name",
	"description",
	"source",
	"updatedAt",
] as const;
const SKILL_UPDATE_FIELDS = [
	"name",
	"description",
	"source",
	"updatedAt",
] as const;

interface EntityCrudDeps {
	db: ServerDatabase["db"];
}

export function matchCrudRoute(pathname: string): CrudRouteMatch | null {
	const match = pathname.match(/^\/api\/(agents|skills)(?:\/([^/]+))?$/);
	if (!match) {
		return null;
	}
	return { entity: match[1] as "agents" | "skills", id: match[2] ?? null };
}

export async function handleEntityCrudRequest(
	request: Request,
	deps: EntityCrudDeps,
	route: CrudRouteMatch,
): Promise<CrudResponseResult> {
	if (route.entity === "agents") {
		return handleAgentRequest(request, deps, route.id);
	}
	return handleSkillRequest(request, deps, route.id);
}

async function handleAgentRequest(
	request: Request,
	deps: EntityCrudDeps,
	id: string | null,
): Promise<CrudResponseResult> {
	if (id === null) {
		if (request.method === "GET") {
			const rows = await deps.db
				.select()
				.from(agentsTable)
				.orderBy(asc(agentsTable.id));
			return { status: 200, body: rows.map((row) => toAgentRecord(row)) };
		}
		if (request.method === "POST") {
			const parsed = await parseJsonBody(request);
			if (!parsed.ok) {
				return { status: 400, body: { error: parsed.error } };
			}
			const validated = validateAgentCreatePayload(parsed.value);
			if (!validated.ok) {
				return { status: 400, body: { error: validated.error } };
			}
			const [created] = await deps.db
				.insert(agentsTable)
				.values(toStoredAgentCreatePayload(validated.value))
				.returning();
			return { status: 201, body: toAgentRecord(created) };
		}
		return { status: 405, body: { error: "Method Not Allowed" } };
	}

	if (request.method === "GET") {
		const [row] = await deps.db
			.select()
			.from(agentsTable)
			.where(eq(agentsTable.id, id));
		if (!row) {
			return { status: 404, body: { error: "Not Found" } };
		}
		return { status: 200, body: toAgentRecord(row) };
	}

	if (request.method === "PATCH") {
		const parsed = await parseJsonBody(request);
		if (!parsed.ok) {
			return { status: 400, body: { error: parsed.error } };
		}
		const validated = validateAgentUpdatePayload(parsed.value);
		if (!validated.ok) {
			return { status: 400, body: { error: validated.error } };
		}
		const [updated] = await deps.db
			.update(agentsTable)
			.set(toStoredAgentUpdatePayload(validated.value))
			.where(eq(agentsTable.id, id))
			.returning();
		if (!updated) {
			return { status: 404, body: { error: "Not Found" } };
		}
		return { status: 200, body: toAgentRecord(updated) };
	}

	if (request.method === "DELETE") {
		const [deleted] = await deps.db
			.delete(agentsTable)
			.where(eq(agentsTable.id, id))
			.returning({ id: agentsTable.id });
		if (!deleted) {
			return { status: 404, body: { error: "Not Found" } };
		}
		return { status: 204 };
	}

	return { status: 405, body: { error: "Method Not Allowed" } };
}

async function handleSkillRequest(
	request: Request,
	deps: EntityCrudDeps,
	id: string | null,
): Promise<CrudResponseResult> {
	if (id === null) {
		if (request.method === "GET") {
			const rows = await deps.db
				.select()
				.from(skillsTable)
				.orderBy(asc(skillsTable.id));
			return { status: 200, body: rows };
		}
		if (request.method === "POST") {
			const parsed = await parseJsonBody(request);
			if (!parsed.ok) {
				return { status: 400, body: { error: parsed.error } };
			}
			const validated = validateCreatePayload<SkillCreatePayload>(
				parsed.value,
				SKILL_CREATE_FIELDS,
			);
			if (!validated.ok) {
				return { status: 400, body: { error: validated.error } };
			}
			const payload = validated.value;
			const [created] = await deps.db
				.insert(skillsTable)
				.values(payload)
				.returning();
			return { status: 201, body: created };
		}
		return { status: 405, body: { error: "Method Not Allowed" } };
	}

	if (request.method === "GET") {
		const [row] = await deps.db
			.select()
			.from(skillsTable)
			.where(eq(skillsTable.id, id));
		if (!row) {
			return { status: 404, body: { error: "Not Found" } };
		}
		return { status: 200, body: row };
	}

	if (request.method === "PATCH") {
		const parsed = await parseJsonBody(request);
		if (!parsed.ok) {
			return { status: 400, body: { error: parsed.error } };
		}
		const validated = validateUpdatePayload<SkillUpdatePayload>(
			parsed.value,
			SKILL_UPDATE_FIELDS,
		);
		if (!validated.ok) {
			return { status: 400, body: { error: validated.error } };
		}
		const payload = validated.value;
		const [updated] = await deps.db
			.update(skillsTable)
			.set(payload)
			.where(eq(skillsTable.id, id))
			.returning();
		if (!updated) {
			return { status: 404, body: { error: "Not Found" } };
		}
		return { status: 200, body: updated };
	}

	if (request.method === "DELETE") {
		const [deleted] = await deps.db
			.delete(skillsTable)
			.where(eq(skillsTable.id, id))
			.returning({ id: skillsTable.id });
		if (!deleted) {
			return { status: 404, body: { error: "Not Found" } };
		}
		return { status: 204 };
	}

	return { status: 405, body: { error: "Method Not Allowed" } };
}
