import { afterEach, describe, expect, it } from "bun:test";
import { createReadRepositories } from "../src/repositories";
import { READ_ONLY_SERVER_PATHS, handleServerRequest } from "../src/routes";
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

describe("server routes", () => {
	it("returns empty arrays for read-only endpoints with empty tables", async () => {
		testDatabase = await createServerTestDatabase();
		const repositories = createReadRepositories(testDatabase.database);

		for (const pathname of READ_ONLY_SERVER_PATHS) {
			const response = await handleServerRequest(
				new Request(`http://localhost${pathname}`),
				{ repositories },
			);
			expect(response.status).toBe(200);
			expect(await response.json()).toEqual([]);
		}
	});

	it("returns seeded records for each endpoint", async () => {
		testDatabase = await createServerTestDatabase();
		await seedServerTestDatabase(testDatabase.database);
		const repositories = createReadRepositories(testDatabase.database);

		const tokenUsageResponse = await handleServerRequest(
			new Request("http://localhost/api/token-usage"),
			{ repositories },
		);
		expect(tokenUsageResponse.status).toBe(200);
		expect(await tokenUsageResponse.json()).toEqual([
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

		const jobsResponse = await handleServerRequest(
			new Request("http://localhost/api/jobs"),
			{ repositories },
		);
		expect(jobsResponse.status).toBe(200);
		expect(await jobsResponse.json()).toEqual([
			{
				id: "job-1",
				projectId: "default",
				issueKey: "ROY-129",
				stage: "implementing",
				status: "in_progress",
				createdAt: "2026-05-12T00:01:00.000Z",
			},
		]);

		const projectBoardsResponse = await handleServerRequest(
			new Request("http://localhost/api/project-boards"),
			{ repositories },
		);
		expect(projectBoardsResponse.status).toBe(200);
		expect(await projectBoardsResponse.json()).toEqual([
			{
				id: "board-1",
				name: "Workspace Board",
				description: "Primary board for workspace planning",
				ownerId: "owner-1",
				createdAt: "2026-05-12T00:05:00.000Z",
				updatedAt: "2026-05-12T00:05:00.000Z",
			},
		]);

		const boardProjectsResponse = await handleServerRequest(
			new Request("http://localhost/api/board-projects"),
			{ repositories },
		);
		expect(boardProjectsResponse.status).toBe(200);
		expect(await boardProjectsResponse.json()).toEqual([
			{
				id: "project-1",
				boardId: "board-1",
				externalProjectId: "ext-project-42",
				name: "API Hardening",
				emoji: null,
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

		const boardTasksResponse = await handleServerRequest(
			new Request("http://localhost/api/board-tasks"),
			{ repositories },
		);
		expect(boardTasksResponse.status).toBe(200);
		expect(await boardTasksResponse.json()).toEqual([
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

	it("returns not found and method not allowed when appropriate", async () => {
		testDatabase = await createServerTestDatabase();
		const repositories = createReadRepositories(testDatabase.database);

		const notFoundResponse = await handleServerRequest(
			new Request("http://localhost/api/unknown"),
			{ repositories },
		);
		expect(notFoundResponse.status).toBe(404);
		expect(await notFoundResponse.json()).toEqual({ error: "Not Found" });

		const methodNotAllowed = await handleServerRequest(
			new Request("http://localhost/api/jobs", { method: "POST" }),
			{ repositories },
		);
		expect(methodNotAllowed.status).toBe(405);
		expect(await methodNotAllowed.json()).toEqual({
			error: "Method Not Allowed",
		});
	});
});
