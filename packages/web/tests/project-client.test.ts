import { describe, expect, it } from "bun:test";
import { createApiClient } from "../src/lib/api/client";
import type { ProjectCreateRequest } from "../src/lib/api/types/client.types";

function okJsonResponse(payload: unknown): Response {
	return new Response(JSON.stringify(payload), {
		status: 200,
		headers: { "content-type": "application/json" },
	});
}

describe("project API client", () => {
	it("creates projects through the server API", async () => {
		const request: ProjectCreateRequest = {
			boardId: "board-1",
			ownerId: "owner-1",
			name: "Web Project",
			emoji: "🧭",
			externalProjectId: "external-1",
			description: "Created from UI",
			repoOwner: "octo",
			repoName: "demo",
			baseBranch: "main",
			localFolder: "/tmp/demo",
			preHookScript: null,
			afterHookScript: null,
			lead: "Roy",
			category: "platform",
			priority: 2,
		};
		const fetchFn = (async (input: URL | RequestInfo, init?: RequestInit) => {
			expect(String(input)).toBe("/api/projects");
			expect(init?.method).toBe("POST");
			expect(init?.headers).toBeInstanceOf(Headers);
			expect((init?.headers as Headers).get("content-type")).toBe(
				"application/json",
			);
			expect(JSON.parse(String(init?.body))).toEqual(request);
			return okJsonResponse({
				...request,
				id: "project-1",
				createdAt: "2026-05-20T00:00:00.000Z",
				updatedAt: "2026-05-20T00:00:00.000Z",
			});
		}) as typeof fetch;
		const client = createApiClient({ fetchFn });

		const project = await client.createProject(request);

		expect(project).toEqual({
			id: "project-1",
			boardId: "board-1",
			workspaceId: "owner-1",
			externalProjectId: "external-1",
			name: "Web Project",
			emoji: "🧭",
			description: "Created from UI",
			repoOwner: "octo",
			repoName: "demo",
			baseBranch: "main",
			localFolder: "/tmp/demo",
			preHookScript: null,
			afterHookScript: null,
			lead: "Roy",
			category: "platform",
			priority: 2,
			isPinned: false,
			createdAt: "2026-05-20T00:00:00.000Z",
			updatedAt: "2026-05-20T00:00:00.000Z",
		});
	});

	it("searches GitHub repositories through the server API", async () => {
		const fetchFn = (async (input: URL | RequestInfo, init?: RequestInit) => {
			expect(String(input)).toBe(
				"/api/github/repositories/search?q=show-me-ur-agents",
			);
			expect(init?.method).toBe("GET");
			return okJsonResponse({
				repositories: [
					{
						id: "7",
						owner: "devos",
						name: "show-me-ur-agents",
						fullName: "devos/show-me-ur-agents",
						htmlUrl: "https://github.com/devos/show-me-ur-agents",
						cloneUrl: "https://github.com/devos/show-me-ur-agents.git",
						defaultBranch: "main",
						description: "Agent workflow UI",
						isPrivate: false,
					},
				],
			});
		}) as typeof fetch;
		const client = createApiClient({ fetchFn });

		await expect(
			client.searchGitHubRepositories(" show-me-ur-agents "),
		).resolves.toEqual([
			{
				id: "7",
				owner: "devos",
				name: "show-me-ur-agents",
				fullName: "devos/show-me-ur-agents",
				htmlUrl: "https://github.com/devos/show-me-ur-agents",
				cloneUrl: "https://github.com/devos/show-me-ur-agents.git",
				defaultBranch: "main",
				description: "Agent workflow UI",
				isPrivate: false,
			},
		]);
	});

	it("updates projects through the server API", async () => {
		const request = {
			name: "Web Project Updated",
			emoji: "🚀",
			description: "Edited from UI",
			repoOwner: "octo",
			repoName: "demo",
			baseBranch: "trunk",
			lead: "Roy",
			priority: 3,
			isPinned: true,
		};
		const fetchFn = (async (input: URL | RequestInfo, init?: RequestInit) => {
			expect(String(input)).toBe("/api/projects/project-1");
			expect(init?.method).toBe("PATCH");
			expect(init?.headers).toBeInstanceOf(Headers);
			expect((init?.headers as Headers).get("content-type")).toBe(
				"application/json",
			);
			expect(JSON.parse(String(init?.body))).toEqual(request);
			return okJsonResponse({
				id: "project-1",
				boardId: "board-1",
				workspaceId: "owner-1",
				externalProjectId: null,
				...request,
				localFolder: null,
				preHookScript: null,
				afterHookScript: null,
				category: null,
				createdAt: "2026-05-20T00:00:00.000Z",
				updatedAt: "2026-05-21T00:00:00.000Z",
			});
		}) as typeof fetch;
		const client = createApiClient({ fetchFn });

		await expect(client.updateProject("project-1", request)).resolves.toEqual({
			id: "project-1",
			boardId: "board-1",
			workspaceId: "owner-1",
			externalProjectId: null,
			name: "Web Project Updated",
			emoji: "🚀",
			description: "Edited from UI",
			repoOwner: "octo",
			repoName: "demo",
			baseBranch: "trunk",
			localFolder: null,
			preHookScript: null,
			afterHookScript: null,
			lead: "Roy",
			category: null,
			priority: 3,
			isPinned: true,
			createdAt: "2026-05-20T00:00:00.000Z",
			updatedAt: "2026-05-21T00:00:00.000Z",
		});
	});

	it("treats missing project emoji values as null", async () => {
		const fetchFn = (async () =>
			okJsonResponse({
				workspaceId: "owner-1",
				projects: [
					{
						id: "project-1",
						boardId: "board-1",
						workspaceId: "owner-1",
						externalProjectId: null,
						name: "Legacy Project",
						description: null,
						repoOwner: null,
						repoName: null,
						baseBranch: null,
						localFolder: null,
						preHookScript: null,
						afterHookScript: null,
						lead: null,
						category: null,
						priority: null,
						isPinned: true,
						createdAt: "2026-05-20T00:00:00.000Z",
						updatedAt: "2026-05-20T00:00:00.000Z",
					},
				],
			})) as typeof fetch;
		const client = createApiClient({ fetchFn });

		const projects = await client.listWorkspaceProjects("owner-1");

		expect(projects[0]?.emoji).toBeNull();
		expect(projects[0]?.isPinned).toBe(true);
	});

	it("treats missing project pin values as false", async () => {
		const fetchFn = (async () =>
			okJsonResponse({
				workspaceId: "owner-1",
				projects: [
					{
						id: "project-1",
						boardId: "board-1",
						workspaceId: "owner-1",
						externalProjectId: null,
						name: "Legacy Project",
						emoji: null,
						description: null,
						repoOwner: null,
						repoName: null,
						baseBranch: null,
						localFolder: null,
						preHookScript: null,
						afterHookScript: null,
						lead: null,
						category: null,
						priority: null,
						createdAt: "2026-05-20T00:00:00.000Z",
						updatedAt: "2026-05-20T00:00:00.000Z",
					},
				],
			})) as typeof fetch;
		const client = createApiClient({ fetchFn });

		const projects = await client.listWorkspaceProjects("owner-1");

		expect(projects[0]?.isPinned).toBe(false);
	});
});
