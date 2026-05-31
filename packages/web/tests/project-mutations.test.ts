import { describe, expect, it } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import type { WorkspaceProjectRecord } from "../src/lib/api";
import * as projectMutations from "../src/lib/api/project-mutations";
import { refreshCreatedProjectCache } from "../src/lib/api/project-mutations";
import { serverStateQueryKeys } from "../src/lib/api/query-keys";

describe("project create mutation cache refresh", () => {
	it("appends the created project and invalidates the workspace project list", async () => {
		const queryClient = new QueryClient();
		const existing = projectRecord("project-existing", "Existing");
		const created = projectRecord("project-created", "Created");
		const queryKey = serverStateQueryKeys.workspaceProjects(
			created.workspaceId,
		);
		queryClient.setQueryData(queryKey, [existing]);

		await refreshCreatedProjectCache(queryClient, created);

		expect(queryClient.getQueryData(queryKey)).toEqual([existing, created]);
		expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(true);
		queryClient.clear();
	});

	it("replaces an updated project and invalidates the workspace project list", async () => {
		const refreshUpdatedProjectCache = (
			projectMutations as {
				refreshUpdatedProjectCache?: (
					queryClient: QueryClient,
					project: WorkspaceProjectRecord,
				) => Promise<void>;
			}
		).refreshUpdatedProjectCache;
		const queryClient = new QueryClient();
		const existing = projectRecord("project-existing", "Existing");
		const updated = {
			...projectRecord("project-created", "Created"),
			name: "Created updated",
			lead: "Roy",
			priority: 3,
		};
		const queryKey = serverStateQueryKeys.workspaceProjects(
			updated.workspaceId,
		);
		queryClient.setQueryData(queryKey, [
			existing,
			projectRecord("project-created", "Created"),
		]);

		await refreshUpdatedProjectCache?.(queryClient, updated);

		expect(queryClient.getQueryData(queryKey)).toEqual([existing, updated]);
		expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(true);
		queryClient.clear();
	});
});

function projectRecord(id: string, name: string): WorkspaceProjectRecord {
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
		createdAt: "2026-05-21T00:00:00.000Z",
		updatedAt: "2026-05-21T00:00:00.000Z",
	};
}
