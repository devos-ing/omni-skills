import { afterEach, describe, expect, it } from "bun:test";
import { createReadRepositories } from "../src/repositories";
import {
	type TestDatabase,
	createServerTestDatabase,
	seedServerTestDatabase,
} from "./server-db-test-helpers";

let testDatabase: TestDatabase | undefined;

afterEach(async () => {
	if (testDatabase) {
		await testDatabase.cleanup();
		testDatabase = undefined;
	}
});

describe("read repositories", () => {
	it("returns empty lists when tables are empty", async () => {
		testDatabase = await createServerTestDatabase();
		const repositories = createReadRepositories(testDatabase.database);

		expect(await repositories.listTokenUsage()).toEqual([]);
		expect(await repositories.listJobs()).toEqual([]);
		expect(await repositories.listAgents()).toEqual([]);
		expect(await repositories.listSkills()).toEqual([]);
		expect(await repositories.listCommandHistory()).toEqual([]);
	});

	it("returns seeded rows with expected mapping", async () => {
		testDatabase = await createServerTestDatabase();
		await seedServerTestDatabase(testDatabase.database);
		const repositories = createReadRepositories(testDatabase.database);

		expect(await repositories.listTokenUsage()).toEqual([
			{
				id: "tu-1",
				runId: "run-1",
				stage: "planning",
				inputTokens: 10,
				outputTokens: 5,
				totalTokens: 15,
				recordedAt: "2026-05-12T00:00:00.000Z",
			},
		]);
		expect(await repositories.listJobs()).toEqual([
			{
				id: "job-1",
				projectId: "default",
				issueKey: "ROY-129",
				stage: "implementing",
				status: "in_progress",
				createdAt: "2026-05-12T00:01:00.000Z",
			},
		]);
		expect(await repositories.listAgents()).toEqual([
			{
				id: "agent-1",
				name: "codex-main",
				backend: "codex",
				model: "gpt-5",
				createdAt: "2026-05-12T00:02:00.000Z",
			},
		]);
		expect(await repositories.listSkills()).toEqual([
			{
				id: "skill-1",
				name: "backend-standard",
				description: "Backend implementation guidance",
				source: "folder",
				updatedAt: "2026-05-12T00:03:00.000Z",
			},
		]);
		expect(await repositories.listCommandHistory()).toEqual([
			{
				id: "cmd-1",
				command: "bun test",
				exitCode: 0,
				executedAt: "2026-05-12T00:04:00.000Z",
			},
		]);
	});
});
