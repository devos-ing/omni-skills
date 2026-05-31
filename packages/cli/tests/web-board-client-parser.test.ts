import { describe, expect, it } from "bun:test";
import { createApiClient } from "../../web/src/lib/api/client";

function okJsonResponse(payload: unknown): Response {
	return new Response(JSON.stringify(payload), {
		status: 200,
		headers: { "content-type": "application/json" },
	});
}

describe("web board client parser", () => {
	it("parses workspace project payloads", async () => {
		const fetchFn = (async (input: URL | RequestInfo) => {
			expect(String(input)).toBe("/api/workspaces/ws-1/projects");
			return okJsonResponse({
				workspaceId: "ws-1",
				projects: [
					{
						id: "project-1",
						boardId: "board-1",
						workspaceId: "ws-1",
						externalProjectId: "ext-1",
						name: "Project 1",
						emoji: null,
						description: null,
						repoOwner: null,
						repoName: null,
						baseBranch: null,
						localFolder: null,
						lead: null,
						category: null,
						priority: null,
						createdAt: "2026-05-14T00:00:00.000Z",
						updatedAt: "2026-05-14T00:00:00.000Z",
					},
				],
			});
		}) as typeof fetch;
		const client = createApiClient({ fetchFn });

		const projects = await client.listWorkspaceProjects("ws-1");

		expect(projects).toHaveLength(1);
		expect(projects[0]?.id).toBe("project-1");
		expect(projects[0]?.externalProjectId).toBe("ext-1");
	});

	it("rejects invalid board task payloads", async () => {
		const fetchFn = (async () =>
			okJsonResponse({
				project: {
					id: "project-1",
					boardId: "board-1",
					workspaceId: "ws-1",
					externalProjectId: null,
					name: "Project 1",
					emoji: null,
					description: null,
					repoOwner: null,
					repoName: null,
					baseBranch: null,
					localFolder: null,
					lead: null,
					category: null,
					priority: null,
					createdAt: "2026-05-14T00:00:00.000Z",
					updatedAt: "2026-05-14T00:00:00.000Z",
				},
				statusColumns: [
					{
						status: "open",
						tasks: [
							{
								id: "task-1",
								taskKey: "TASK-000001",
								projectId: "project-1",
								title: "Task",
								content: "content",
								priority: "high",
								status: "open",
								dueDate: null,
								creatorId: "owner-1",
								linkedPr: null,
								createdAt: "2026-05-14T00:00:00.000Z",
								updatedAt: "2026-05-14T00:00:00.000Z",
							},
						],
					},
				],
			})) as unknown as typeof fetch;
		const client = createApiClient({ fetchFn });

		await expect(client.getProjectBoard("ws-1", "project-1")).rejects.toThrow(
			"Invalid /api/tasks response field 'priority'",
		);
	});
});
