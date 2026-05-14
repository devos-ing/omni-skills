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
				stage: "planning",
				inputTokens: 10,
				outputTokens: 5,
				totalTokens: 15,
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
