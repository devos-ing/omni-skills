import { describe, expect, it } from "bun:test";
import { createTaskCreatedActivity } from "../../web/src/components/issues-board/issue-activity-utils";
import { createApiClient } from "../../web/src/lib/api/client";
import { ApiRequestError } from "../../web/src/lib/api/response-utils";
import { parseTaskActivityResponse } from "../../web/src/lib/api/task-activity-client";

describe("web api client task activity", () => {
	it("parses task activity responses and rejects malformed records", async () => {
		const fetchFn = (async () =>
			new Response(
				JSON.stringify({
					taskId: "task-1",
					activities: [
						{
							id: "comment-1",
							kind: "comment",
							actorId: "piv-planner",
							actorType: "agent",
							title: "commented on this issue",
							body: "# Plan\n- Edit `page.tsx`",
							status: null,
							createdAt: "2026-05-13T00:00:00.000Z",
							steps: [],
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			)) as unknown as typeof fetch;
		const client = createApiClient({
			baseUrl: "http://localhost:3000",
			fetchFn,
		});

		const response = await client.listTaskActivity("task-1");

		expect(response.activities[0]).toMatchObject({
			kind: "comment",
			body: "# Plan\n- Edit `page.tsx`",
			steps: [],
		});
		expect(() =>
			parseTaskActivityResponse({
				taskId: "task-1",
				activities: [{ id: "bad", kind: "unknown" }],
			}),
		).toThrow("kind");
	});

	it("preserves failed request HTTP status", async () => {
		const fetchFn = (async () =>
			new Response(JSON.stringify({ error: "Task not found" }), {
				status: 404,
				headers: { "content-type": "application/json" },
			})) as unknown as typeof fetch;
		const client = createApiClient({
			baseUrl: "http://localhost:3000",
			fetchFn,
		});

		try {
			await client.listTaskActivity("task-1");
			throw new Error("Expected listTaskActivity to fail");
		} catch (error) {
			expect(error).toBeInstanceOf(ApiRequestError);
			expect((error as ApiRequestError).status).toBe(404);
			expect((error as ApiRequestError).path).toBe(
				"/api/tasks/task-1/activity",
			);
		}
	});

	it("builds a local created activity fallback from a loaded task", () => {
		const activity = createTaskCreatedActivity({
			id: "task-1",
			taskKey: "TASK-1",
			projectId: null,
			title: "Smoke test",
			content: "Check the flow",
			priority: 1,
			status: "planning",
			dueDate: null,
			creatorId: "roy",
			assigneeId: null,
			linkedPr: null,
			createdAt: "2026-05-15T07:41:12.103Z",
			updatedAt: "2026-05-15T17:35:54.733Z",
		});

		expect(activity).toMatchObject({
			id: "task-1:created:fallback",
			kind: "created",
			actorId: "roy",
			actorType: "human",
			title: "created this issue",
			status: "planning",
			createdAt: "2026-05-15T07:41:12.103Z",
		});
	});
});
