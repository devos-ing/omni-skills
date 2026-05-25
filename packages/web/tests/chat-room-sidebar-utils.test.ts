import { describe, expect, it } from "bun:test";

import { buildChatSessionProjectGroups } from "../src/components/chat-room/chat-room-sidebar-utils";
import type { ChatSessionRecord, WorkspaceProjectRecord } from "../src/lib/api";

describe("chat room sidebar utilities", () => {
	it("groups sessions by project name and preserves session order", () => {
		const projectA = buildProject({ id: "project-a", name: "Project A" });
		const projectB = buildProject({ id: "project-b", name: "Project B" });

		const groups = buildChatSessionProjectGroups({
			activeSessionId: "session-2",
			projects: [projectA, projectB],
			sessions: [
				buildSession({ id: "session-1", projectId: "project-a" }),
				buildSession({ id: "session-2", projectId: "project-a" }),
				buildSession({ id: "session-3", projectId: "project-b" }),
			],
		});

		expect(groups.map((group) => group.label)).toEqual([
			"Project A",
			"Project B",
		]);
		expect(groups[0]?.sessions.map((session) => session.id)).toEqual([
			"session-1",
			"session-2",
		]);
		expect(groups[1]?.sessions.map((session) => session.id)).toEqual([
			"session-3",
		]);
	});

	it("marks the group containing the active session", () => {
		const groups = buildChatSessionProjectGroups({
			activeSessionId: "session-3",
			projects: [
				buildProject({ id: "project-a", name: "Project A" }),
				buildProject({ id: "project-b", name: "Project B" }),
			],
			sessions: [
				buildSession({ id: "session-1", projectId: "project-a" }),
				buildSession({ id: "session-3", projectId: "project-b" }),
			],
		});

		expect(groups).toMatchObject([
			{ id: "project-a", isActive: false },
			{ id: "project-b", isActive: true },
		]);
	});

	it("groups null and unknown project ids as unassigned", () => {
		const groups = buildChatSessionProjectGroups({
			activeSessionId: "unknown-session",
			projects: [buildProject({ id: "project-a", name: "Project A" })],
			sessions: [
				buildSession({ id: "unknown-session", projectId: "missing-project" }),
				buildSession({ id: "loose-session", projectId: null }),
				buildSession({ id: "known-session", projectId: "project-a" }),
			],
		});

		expect(groups[0]).toMatchObject({
			id: "unassigned",
			label: "Unassigned",
			isActive: true,
		});
		expect(groups[0]?.sessions.map((session) => session.id)).toEqual([
			"unknown-session",
			"loose-session",
		]);
		expect(groups[1]).toMatchObject({
			id: "project-a",
			label: "Project A",
			isActive: false,
		});
	});

	it("returns no groups for an empty session list", () => {
		const groups = buildChatSessionProjectGroups({
			activeSessionId: "",
			projects: [buildProject({ id: "project-a", name: "Project A" })],
			sessions: [],
		});

		expect(groups).toEqual([]);
	});
});

function buildSession(
	overrides: Partial<ChatSessionRecord> = {},
): ChatSessionRecord {
	return {
		id: "session-1",
		workspaceId: "workspace-1",
		projectId: "project-a",
		taskId: null,
		title: "Untitled",
		pendingRequest: null,
		pendingQuestions: [],
		createdAt: "2026-05-25T00:00:00.000Z",
		updatedAt: "2026-05-25T00:00:00.000Z",
		...overrides,
	};
}

function buildProject(
	overrides: Partial<WorkspaceProjectRecord> = {},
): WorkspaceProjectRecord {
	return {
		id: "project-a",
		boardId: "board-1",
		workspaceId: "workspace-1",
		externalProjectId: null,
		name: "Project A",
		description: null,
		repoOwner: null,
		repoName: null,
		baseBranch: null,
		localFolder: null,
		lead: null,
		category: null,
		priority: null,
		createdAt: "2026-05-25T00:00:00.000Z",
		updatedAt: "2026-05-25T00:00:00.000Z",
		...overrides,
	};
}
