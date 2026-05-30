import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { initializeServerDatabase } from "devos-db";
import { createHandleRequest } from "../src/app";
import type { AppDeps } from "../src/types/app.types";

describe("agent migration routes", () => {
	it("upgrades old agents tables before /api/agents reads", async () => {
		const tempDir = await mkdtemp(path.join(os.tmpdir(), "adhd-agent-old-"));
		const databasePath = path.join(tempDir, "db");

		try {
			const oldDatabase = await initializeServerDatabase(databasePath, {
				runMigrations: false,
			});
			await oldDatabase.client.query(`
				CREATE TABLE agents (
					id text PRIMARY KEY,
					name text NOT NULL,
					backend text NOT NULL,
					model text NOT NULL,
					created_at timestamp NOT NULL
				);
			`);
			await oldDatabase.client.query(`
				INSERT INTO agents (id, name, backend, model, created_at)
				VALUES ('agent-legacy', 'legacy-codex', 'codex', 'gpt-5', '2026-05-12 04:00:00');
			`);
			await oldDatabase.close();

			const database = await initializeServerDatabase(databasePath);
			const app = createHandleRequest({
				cliExecutor: {
					execute: async (request) => ({ status: "succeeded", request }),
					getHistory: () => [],
				},
				db: database.db,
			} satisfies AppDeps);

			const response = await app(new Request("http://localhost/api/agents"));
			expect(response.status).toBe(200);

			const payload = (await response.json()) as Array<Record<string, unknown>>;
			expect(payload).toHaveLength(1);
			expect(payload[0]).toEqual(
				expect.objectContaining({
					id: "agent-legacy",
					name: "legacy-codex",
					description: "",
					logo: "",
					runtime: "codex",
					backend: "codex",
					model: "gpt-5",
					reasoningEffort: null,
					status: "online",
					concurrency: 1,
					owner: "unassigned",
					skills: [],
					recentWork: [],
					activity: [],
					instructions: "",
				}),
			);
			expect(typeof payload[0]?.createdAt).toBe("string");
			expect(String(payload[0]?.createdAt).length).toBeGreaterThan(0);
			expect(typeof payload[0]?.updatedAt).toBe("string");
			expect(String(payload[0]?.updatedAt).length).toBeGreaterThan(0);

			await database.close();
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});
