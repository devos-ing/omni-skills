import { describe, expect, it } from "bun:test";
import { createHandleRequest } from "../src/app";
import { REQUIRED_BOARD_STATUSES } from "../src/board";
import type { AppDeps } from "../src/types/app.types";

type TestBoardRepository = NonNullable<AppDeps["boardRepository"]>;

describe("board routes", () => {
	it("lists workspace-scoped projects", async () => {
		const app = createHandleRequest(
			createDeps({
				listWorkspaceProjects: async (workspaceId) => [
					{
						id: "project-1",
						boardId: "board-1",
						workspaceId,
						externalProjectId: "ROY",
						name: "Server",
						emoji: null,
						description: null,
						repoOwner: null,
						repoName: null,
						baseBranch: null,
						localFolder: null,
						lead: null,
						category: null,
						priority: null,
						createdAt: "2026-05-14 00:00:00",
						updatedAt: "2026-05-14 00:00:00",
					},
				],
			}),
		);

		const response = await app(
			new Request("http://localhost/api/workspaces/workspace-1/projects", {
				method: "GET",
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			workspaceId: "workspace-1",
			projects: [
				{
					id: "project-1",
					boardId: "board-1",
					workspaceId: "workspace-1",
					externalProjectId: "ROY",
					name: "Server",
					emoji: null,
					description: null,
					repoOwner: null,
					repoName: null,
					baseBranch: null,
					localFolder: null,
					lead: null,
					category: null,
					priority: null,
					createdAt: "2026-05-14 00:00:00",
					updatedAt: "2026-05-14 00:00:00",
				},
			],
		});
	});

	it("returns workspace project board payload", async () => {
		const app = createHandleRequest(
			createDeps({
				getWorkspaceProjectBoard: async (workspaceId, projectId) => ({
					project: {
						id: projectId,
						boardId: "board-1",
						workspaceId,
						externalProjectId: "ROY",
						name: "Server",
						emoji: null,
						description: null,
						repoOwner: null,
						repoName: null,
						baseBranch: null,
						localFolder: null,
						lead: null,
						category: null,
						priority: null,
						createdAt: "2026-05-14 00:00:00",
						updatedAt: "2026-05-14 00:00:00",
					},
					statusColumns: REQUIRED_BOARD_STATUSES.map((status) => ({
						status,
						tasks: [],
					})),
				}),
			}),
		);

		const response = await app(
			new Request(
				"http://localhost/api/workspaces/workspace-1/projects/project-1/board",
				{ method: "GET" },
			),
		);

		expect(response.status).toBe(200);
		expect((await response.json()).project.id).toBe("project-1");
	});

	it("returns 404 for missing workspace project board", async () => {
		const app = createHandleRequest(
			createDeps({
				getWorkspaceProjectBoard: async () => null,
			}),
		);
		const response = await app(
			new Request(
				"http://localhost/api/workspaces/workspace-1/projects/project-1/board",
				{ method: "GET" },
			),
		);
		expect(response.status).toBe(404);
	});

	it("returns 405 for unsupported board route methods", async () => {
		const app = createHandleRequest(createDeps());
		const listResponse = await app(
			new Request("http://localhost/api/workspaces/workspace-1/projects", {
				method: "POST",
			}),
		);
		const boardResponse = await app(
			new Request(
				"http://localhost/api/workspaces/workspace-1/projects/project-1/board",
				{
					method: "DELETE",
				},
			),
		);
		expect(listResponse.status).toBe(405);
		expect(boardResponse.status).toBe(405);
	});
});

function createDeps(overrides?: {
	listWorkspaceProjects?: TestBoardRepository["listWorkspaceProjects"];
	getWorkspaceProjectBoard?: TestBoardRepository["getWorkspaceProjectBoard"];
}): AppDeps {
	return {
		cliExecutor: {
			execute: async (request) => ({
				status: "succeeded",
				request,
			}),
			executeStream: async (request) => ({
				status: "succeeded",
				request,
			}),
			getHistory: () => [],
		},
		boardRepository: {
			listWorkspaceProjects:
				overrides?.listWorkspaceProjects ?? (async () => []),
			getWorkspaceProjectBoard:
				overrides?.getWorkspaceProjectBoard ?? (async () => null),
		},
	};
}
