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
		expect(await repositories.listProjectBoards()).toEqual([]);
		expect(await repositories.listBoardProjects()).toEqual([]);
		expect(await repositories.listBoardTasks()).toEqual([]);
	});

	it("returns seeded rows with expected mapping", async () => {
		testDatabase = await createServerTestDatabase();
		await seedServerTestDatabase(testDatabase.database);
		const repositories = createReadRepositories(testDatabase.database);

		expect(await repositories.listTokenUsage()).toEqual([
			{
				id: "tu-1",
				runId: "run-1",
				taskId: null,
				taskExecutionLogId: null,
				stage: "planning",
				agentBackend: null,
				model: null,
				inputTokens: 10,
				outputTokens: 5,
				totalTokens: 15,
				estimatedCostMicrousd: null,
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
				description: "Primary coding agent",
				logo: "https://example.com/codex.svg",
				runtime: "codex",
				backend: "codex",
				model: "gpt-5",
				reasoningEffort: null,
				status: "online",
				concurrency: 2,
				owner: "owner-1",
				createdAt: "2026-05-12T00:02:00.000Z",
				updatedAt: "2026-05-12T00:03:00.000Z",
				skills: ["adhd-plan", "adhd-implement"],
				recentWork: ["ROY-228"],
				activity: ["planning"],
				instructions: "Keep responses implementation-focused.",
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
		expect(await repositories.listProjectBoards()).toEqual([
			{
				id: "board-1",
				name: "Workspace Board",
				description: "Primary board for workspace planning",
				ownerId: "owner-1",
				createdAt: "2026-05-12T00:05:00.000Z",
				updatedAt: "2026-05-12T00:05:00.000Z",
			},
		]);
		expect(await repositories.listBoardProjects()).toEqual([
			{
				id: "project-1",
				boardId: "board-1",
				externalProjectId: "ext-project-42",
				name: "API Hardening",
				description: "Contract and route updates",
				repoOwner: null,
				repoName: null,
				baseBranch: null,
				localFolder: null,
				lead: null,
				category: null,
				priority: null,
				ownerId: "owner-1",
				createdAt: "2026-05-12T00:06:00.000Z",
				updatedAt: "2026-05-12T00:06:00.000Z",
			},
		]);
		expect(await repositories.listBoardTasks()).toEqual([
			{
				id: "task-1",
				taskKey: "TASK-000001",
				projectId: "project-1",
				title: "Document board APIs",
				content: "Update OpenAPI and tests for board endpoints",
				priority: 2,
				status: "todo",
				dueDate: null,
				creatorId: "owner-1",
				assigneeId: null,
				linkedPr: null,
				createdAt: "2026-05-12T00:07:00.000Z",
				updatedAt: "2026-05-12T00:07:00.000Z",
			},
		]);
	});
});
