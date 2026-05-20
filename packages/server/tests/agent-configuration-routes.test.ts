import { afterEach, describe, expect, it } from "bun:test";
import { createHandleRequest } from "../src/app";
import type { AppDeps } from "../src/app.types";
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

describe("agent configuration validation", () => {
	it("accepts known backends and known models", async () => {
		const response = await createAgent({
			id: "agent-known-model",
			name: "codex-known",
			backend: "CODEX",
			model: "gpt-5.5",
			createdAt: "2026-05-12 00:02:00",
		});

		expect(response.status).toBe(201);
		expect(await response.json()).toMatchObject({
			backend: "codex",
			model: "gpt-5.5",
			runtime: "codex",
		});
	});

	it("allows custom model ids for known backends", async () => {
		const response = await createAgent({
			id: "agent-custom-model",
			name: "codex-custom",
			backend: "codex",
			model: "gpt-custom-future",
			createdAt: "2026-05-12 00:02:00",
		});

		expect(response.status).toBe(201);
		expect(await response.json()).toMatchObject({
			backend: "codex",
			model: "gpt-custom-future",
		});
	});

	it("rejects unknown agent backends", async () => {
		const response = await createAgent({
			id: "agent-unknown-backend",
			name: "unknown-agent",
			backend: "unknown",
			model: "gpt-5",
			createdAt: "2026-05-12 00:02:00",
		});

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: "Malformed request: field 'backend' has invalid value",
		});
	});
});

async function createAgent(body: unknown): Promise<Response> {
	const app = await createApp();
	return app(jsonRequest("POST", "/api/agents", body));
}

async function createApp() {
	testDatabase = await createDrizzleServerTestDatabase();
	const deps: AppDeps = {
		db: testDatabase.db,
		cliExecutor: {
			execute: async (request) => ({ status: "succeeded", request }),
			executeStream: async (request) => ({ status: "succeeded", request }),
			getHistory: () => [],
		},
	};
	return createHandleRequest(deps);
}

function jsonRequest(method: string, pathname: string, body: unknown): Request {
	return new Request(`http://localhost${pathname}`, {
		method,
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
}
