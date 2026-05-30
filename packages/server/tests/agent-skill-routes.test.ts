import { afterEach, describe, expect, it } from "bun:test";
import type {
	AgentCreatePayload,
	SkillCreatePayload,
} from "../src/routes/types/entity-crud.types";
import { createJsonRequest, createServerTestApp } from "./app-test-helpers";
import {
	type DrizzleServerTestDatabase,
	createDrizzleServerTestDatabase,
} from "./server-db-test-helpers";

let testDatabase: DrizzleServerTestDatabase | undefined;

afterEach(async () => {
	if (testDatabase) {
		await testDatabase.cleanup();
		testDatabase = undefined;
	}
});

describe("agent and skill CRUD routes", () => {
	it("creates, lists, reads, updates, and deletes agents", async () => {
		const app = await createApp();
		const payload: AgentCreatePayload = {
			id: "agent-1",
			name: "codex-main",
			description: "Primary coding agent",
			logo: "https://example.com/codex.svg",
			runtime: "codex",
			backend: "codex",
			model: "gpt-5",
			reasoningEffort: "high",
			status: "offline",
			concurrency: 2,
			owner: "roy",
			createdAt: "2026-05-12 00:02:00",
			updatedAt: "2026-05-12 00:03:00",
			skills: ["adhd-plan", "adhd-implement"],
			recentWork: ["ROY-228", "ROY-229"],
			activity: ["planning", "implementing"],
			instructions: "Keep responses implementation-focused.",
		};

		const createResponse = await app(
			createJsonRequest("POST", "/api/agents", payload),
		);
		expect(createResponse.status).toBe(201);
		expect(await createResponse.json()).toEqual(payload);

		const listResponse = await app(new Request("http://localhost/api/agents"));
		expect(listResponse.status).toBe(200);
		expect(await listResponse.json()).toEqual([payload]);

		const readResponse = await app(
			new Request("http://localhost/api/agents/agent-1"),
		);
		expect(readResponse.status).toBe(200);
		expect(await readResponse.json()).toEqual(payload);

		const updateResponse = await app(
			createJsonRequest("PATCH", "/api/agents/agent-1", {
				model: "gpt-5.1",
				reasoningEffort: "xhigh",
				status: "online",
				concurrency: 4,
				skills: ["adhd-review"],
			}),
		);
		expect(updateResponse.status).toBe(200);
		expect(await updateResponse.json()).toEqual({
			...payload,
			model: "gpt-5.1",
			reasoningEffort: "xhigh",
			status: "online",
			concurrency: 4,
			skills: ["adhd-review"],
		});

		const deleteResponse = await app(
			new Request("http://localhost/api/agents/agent-1", { method: "DELETE" }),
		);
		expect(deleteResponse.status).toBe(204);
		expect(await deleteResponse.text()).toBe("");

		const readMissing = await app(
			new Request("http://localhost/api/agents/agent-1"),
		);
		expect(readMissing.status).toBe(404);
		expect(await readMissing.json()).toEqual({ error: "Not Found" });
	});

	it("accepts dialog-shaped agent patch with blank optional metadata", async () => {
		const app = await createApp();
		const createdAt = "2026-05-12 00:02:00";

		const createResponse = await app(
			createJsonRequest("POST", "/api/agents", {
				id: "agent-empty",
				name: "codex-empty",
				backend: "codex",
				model: "gpt-5",
				createdAt,
			}),
		);
		expect(createResponse.status).toBe(201);
		const createdAgent = (await createResponse.json()) as AgentCreatePayload;

		const patchResponse = await app(
			createJsonRequest("PATCH", "/api/agents/agent-empty", {
				name: createdAgent.name,
				description: "",
				logo: "",
				runtime: createdAgent.runtime ?? "codex",
				backend: createdAgent.backend,
				model: "gpt-5.1",
				concurrency: createdAgent.concurrency ?? 1,
				owner: createdAgent.owner ?? "unassigned",
				createdAt: createdAgent.createdAt,
				updatedAt: createdAgent.updatedAt ?? createdAt,
				skills: createdAgent.skills ?? [],
				recentWork: createdAgent.recentWork ?? [],
				activity: createdAgent.activity ?? [],
				instructions: "",
			}),
		);
		expect(patchResponse.status).toBe(200);
		expect(await patchResponse.json()).toEqual({
			...createdAgent,
			description: "",
			logo: "",
			model: "gpt-5.1",
			reasoningEffort: null,
			status: "online",
			instructions: "",
		});
	});

	it("creates, lists, reads, updates, and deletes skills", async () => {
		const app = await createApp();
		const payload: SkillCreatePayload = {
			id: "skill-1",
			name: "backend-standard",
			description: "Backend implementation guidance",
			source: "folder",
			updatedAt: "2026-05-12 00:03:00",
		};

		const createResponse = await app(
			createJsonRequest("POST", "/api/skills", payload),
		);
		expect(createResponse.status).toBe(201);
		expect(await createResponse.json()).toEqual(payload);

		const listResponse = await app(new Request("http://localhost/api/skills"));
		expect(listResponse.status).toBe(200);
		expect(await listResponse.json()).toEqual([payload]);

		const readResponse = await app(
			new Request("http://localhost/api/skills/skill-1"),
		);
		expect(readResponse.status).toBe(200);
		expect(await readResponse.json()).toEqual(payload);

		const updateResponse = await app(
			createJsonRequest("PATCH", "/api/skills/skill-1", { source: "inline" }),
		);
		expect(updateResponse.status).toBe(200);
		expect(await updateResponse.json()).toEqual({
			...payload,
			source: "inline",
		});

		const deleteResponse = await app(
			new Request("http://localhost/api/skills/skill-1", { method: "DELETE" }),
		);
		expect(deleteResponse.status).toBe(204);
		expect(await deleteResponse.text()).toBe("");
	});

	it("rejects invalid payloads for agents and skills", async () => {
		const app = await createApp();

		const malformedJson = await app(
			new Request("http://localhost/api/agents", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: "{bad-json}",
			}),
		);
		expect(malformedJson.status).toBe(400);
		expect(await malformedJson.json()).toEqual({
			error: "Malformed JSON body",
		});

		const missingField = await app(
			createJsonRequest("POST", "/api/agents", {
				id: "agent-1",
				name: "codex-main",
				backend: "codex",
				model: "gpt-5",
			}),
		);
		expect(missingField.status).toBe(400);
		expect(await missingField.json()).toEqual({
			error: "Malformed request: missing required field 'createdAt'",
		});

		const wrongAgentFieldType = await app(
			createJsonRequest("POST", "/api/agents", {
				id: "agent-1",
				name: "codex-main",
				backend: "codex",
				model: "gpt-5",
				createdAt: "2026-05-12 00:02:00",
				skills: ["adhd-plan", 1],
			}),
		);
		expect(wrongAgentFieldType.status).toBe(400);
		expect(await wrongAgentFieldType.json()).toEqual({
			error: "Malformed request: field 'skills' has invalid value",
		});

		const wrongType = await app(
			createJsonRequest("POST", "/api/skills", {
				id: "skill-1",
				name: "backend-standard",
				description: "Backend implementation guidance",
				source: "folder",
				updatedAt: 42,
			}),
		);
		expect(wrongType.status).toBe(400);
		expect(await wrongType.json()).toEqual({
			error: "Malformed request: field 'updatedAt' must be a non-empty string",
		});

		const emptyPatch = await app(
			createJsonRequest("PATCH", "/api/agents/agent-1", {}),
		);
		expect(emptyPatch.status).toBe(400);
		expect(await emptyPatch.json()).toEqual({
			error: "Malformed request: expected at least one field",
		});

		const unknownField = await app(
			createJsonRequest("PATCH", "/api/skills/skill-1", { id: "nope" }),
		);
		expect(unknownField.status).toBe(400);
		expect(await unknownField.json()).toEqual({
			error: "Malformed request: unknown field 'id'",
		});
	});

	it("returns not found for missing records and method-not-allowed for unsupported methods", async () => {
		const app = await createApp();

		const missingRead = await app(
			new Request("http://localhost/api/skills/missing"),
		);
		expect(missingRead.status).toBe(404);
		expect(await missingRead.json()).toEqual({ error: "Not Found" });

		const missingPatch = await app(
			createJsonRequest("PATCH", "/api/agents/missing", {
				model: "gpt-5.1",
				concurrency: 2,
			}),
		);
		expect(missingPatch.status).toBe(404);
		expect(await missingPatch.json()).toEqual({ error: "Not Found" });

		const missingDelete = await app(
			new Request("http://localhost/api/skills/missing", { method: "DELETE" }),
		);
		expect(missingDelete.status).toBe(404);
		expect(await missingDelete.json()).toEqual({ error: "Not Found" });

		const methodNotAllowed = await app(
			new Request("http://localhost/api/agents/agent-1", { method: "POST" }),
		);
		expect(methodNotAllowed.status).toBe(405);
		expect(await methodNotAllowed.json()).toEqual({
			error: "Method Not Allowed",
		});
	});
});

async function createApp() {
	testDatabase = await createDrizzleServerTestDatabase();
	return createServerTestApp(testDatabase.db);
}
