import { describe, expect, it } from "bun:test";

import {
	type AgentRow,
	type ServerDatabase,
	type ServerDb,
	agentsTable,
	initializeServerDatabase,
	runMigrations,
} from "devos-server/db";

describe("db boundary export", () => {
	it("exports db runtime and schema symbols through devos-server/db", () => {
		expect(typeof initializeServerDatabase).toBe("function");
		expect(typeof runMigrations).toBe("function");
		expect(agentsTable).toBeDefined();

		const typedRow: AgentRow = {
			id: "agent-1",
			name: "codex",
			description: "Primary coding agent",
			logo: "https://example.com/codex.svg",
			runtime: "codex",
			backend: "codex",
			model: "gpt-5",
			reasoningEffort: null,
			status: "online",
			concurrency: 1,
			owner: "owner-1",
			createdAt: "2026-05-13 00:00:00",
			updatedAt: "2026-05-13 00:00:00",
			skills: "[]",
			recentWork: "[]",
			activity: "[]",
			instructions: "Stay focused on implementation scope.",
		};
		expect(typedRow.id).toBe("agent-1");

		type CloseFn = ServerDatabase["close"];
		const closeFn: CloseFn = async () => {};
		expect(typeof closeFn).toBe("function");

		const acceptDb = (_db: ServerDb) => undefined;
		expect(typeof acceptDb).toBe("function");
	});
});
