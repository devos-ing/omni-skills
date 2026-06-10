import { describe, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import type { WorkspaceProjectRecord } from "../src/lib/api";
import {
	refreshCreatedProjectCache,
	refreshUpdatedProjectCache,
} from "../src/lib/api/project-mutations";
import { serverStateQueryKeys } from "../src/lib/api/query-keys";

describe("project create mutation cache refresh", () => {
	it("adds the created project in pinned-first order and invalidates the workspace project list", async () => {
		const queryClient = new QueryClient();
		const existing = projectRecord("project-existing", "Existing");
		const created = projectRecord("project-created", "Created", {
			isPinned: true,
		});
		const queryKey = serverStateQueryKeys.workspaceProjects(
			created.workspaceId,
		);
		queryClient.setQueryData(queryKey, [existing]);

		await refreshCreatedProjectCache(queryClient, created);

		expect(queryClient.getQueryData(queryKey)).toEqual([created, existing]);
		expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(true);
		queryClient.clear();
	});

	it("replaces an updated project in pinned-first order and invalidates affected project caches", async () => {
		const queryClient = new QueryClient();
		const existing = projectRecord("project-existing", "Existing");
		const pinned = projectRecord("project-pinned", "Pinned", {
			createdAt: "2026-05-20T00:00:00.000Z",
			isPinned: true,
		});
		const updated = projectRecord("project-existing", "Updated", {
			isPinned: true,
		});
		const listKey = serverStateQueryKeys.workspaceProjects(updated.workspaceId);
		const boardKey = serverStateQueryKeys.projectBoard(
			updated.workspaceId,
			updated.id,
		);
		queryClient.setQueryData(listKey, [existing, pinned]);
		queryClient.setQueryData(boardKey, {
			project: existing,
			statusColumns: [],
		});

		await refreshUpdatedProjectCache(queryClient, updated);

		expect(queryClient.getQueryData(listKey)).toEqual([pinned, updated]);
		expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true);
		expect(queryClient.getQueryState(boardKey)?.isInvalidated).toBe(true);
		queryClient.clear();
	});
});

function projectRecord(
	id: string,
	name: string,
	overrides: Partial<WorkspaceProjectRecord> = {},
): WorkspaceProjectRecord {
	return {
		id,
		boardId: "board-1",
		workspaceId: "owner-1",
		externalProjectId: null,
		name,
		emoji: null,
		description: null,
		repoOwner: null,
		repoName: null,
		baseBranch: null,
		localFolder: null,
		lead: null,
		category: null,
		priority: null,
		isPinned: false,
		preHookScript: null,
		afterHookScript: null,
		createdAt: "2026-05-21T00:00:00.000Z",
		updatedAt: "2026-05-21T00:00:00.000Z",
		...overrides,
	};
}
