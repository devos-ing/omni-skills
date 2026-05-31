import { describe, expect, it } from "bun:test";

import {
	buildChatSessionProjectGroups,
	buildChatSessionSidebarContent,
	buildProjectSessionListToggleMode,
	buildVisibleProjectSessions,
} from "../src/components/chat-room/chat-room-sidebar-utils";
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

	it("partitions pinned sessions above unpinned project groups", () => {
		const projectA = buildProject({ id: "project-a", name: "Project A" });
		const projectB = buildProject({ id: "project-b", name: "Project B" });

		const content = buildChatSessionSidebarContent({
			activeSessionId: "session-4",
			pinnedSessionIds: ["missing-session", "session-3", "session-1"],
			projects: [projectA, projectB],
			sessions: [
				buildSession({ id: "session-1", projectId: "project-a" }),
				buildSession({ id: "session-2", projectId: "project-a" }),
				buildSession({ id: "session-3", projectId: "project-b" }),
				buildSession({ id: "session-4", projectId: "project-b" }),
			],
		});

		expect(content.pinnedSessions.map((session) => session.id)).toEqual([
			"session-1",
			"session-3",
		]);
		expect(content.projectGroups.map((group) => group.label)).toEqual([
			"Project A",
			"Project B",
		]);
		expect(
			content.projectGroups[0]?.sessions.map((session) => session.id),
		).toEqual(["session-2"]);
		expect(content.projectGroups[1]).toMatchObject({
			id: "project-b",
			isActive: true,
		});
		expect(
			content.projectGroups[1]?.sessions.map((session) => session.id),
		).toEqual(["session-4"]);
	});

	it("keeps all sessions visible when a project has five sessions", () => {
		const sessions = buildSessionList(5);

		const result = buildVisibleProjectSessions({
			isExpanded: false,
			sessions,
		});

		expect(result.sessions).toEqual(sessions);
		expect(result).toMatchObject({
			hasOverflow: false,
			hiddenSessionCount: 0,
		});
	});

	it("shows the first five sessions by default when a project has more sessions", () => {
		const sessions = buildSessionList(7);

		const result = buildVisibleProjectSessions({
			isExpanded: false,
			sessions,
		});

		expect(result.sessions).toEqual(sessions.slice(0, 5));
		expect(result).toMatchObject({
			hasOverflow: true,
			hiddenSessionCount: 2,
		});
	});

	it("shows all overflow sessions when a project session list is expanded", () => {
		const sessions = buildSessionList(7);

		const result = buildVisibleProjectSessions({
			isExpanded: true,
			sessions,
		});

		expect(result.sessions).toEqual(sessions);
		expect(result).toMatchObject({
			hasOverflow: true,
			hiddenSessionCount: 0,
		});
	});

	it("preserves existing session order when collapsing overflow sessions", () => {
		const sessions = [
			buildSession({ id: "session-6" }),
			buildSession({ id: "session-2" }),
			buildSession({ id: "session-5" }),
			buildSession({ id: "session-1" }),
			buildSession({ id: "session-4" }),
			buildSession({ id: "session-3" }),
		];

		const result = buildVisibleProjectSessions({
			isExpanded: false,
			sessions,
		});

		expect(result.sessions).toEqual(sessions.slice(0, 5));
		expect(result.hiddenSessionCount).toBe(1);
	});

	it("enables the overflow session-list toggle only when a project has hidden sessions", () => {
		const visibleProjectSessions = buildVisibleProjectSessions({
			isExpanded: false,
			sessions: buildSessionList(7),
		});
		const expandedProjectSessions = buildVisibleProjectSessions({
			isExpanded: true,
			sessions: buildSessionList(7),
		});
		const shortProjectSessions = buildVisibleProjectSessions({
			isExpanded: false,
			sessions: buildSessionList(5),
		});

		expect(
			buildProjectSessionListToggleMode({
				isExpanded: false,
				visibleProjectSessions,
			}),
		).toBe("collapsed");
		expect(
			buildProjectSessionListToggleMode({
				isExpanded: true,
				visibleProjectSessions: expandedProjectSessions,
			}),
		).toBe("expanded");
		expect(
			buildProjectSessionListToggleMode({
				isExpanded: false,
				visibleProjectSessions: shortProjectSessions,
			}),
		).toBeNull();
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
		archived: false,
		createdAt: "2026-05-25T00:00:00.000Z",
		updatedAt: "2026-05-25T00:00:00.000Z",
		...overrides,
	};
}

function buildSessionList(count: number): ChatSessionRecord[] {
	return Array.from({ length: count }, (_, index) =>
		buildSession({ id: `session-${index + 1}` }),
	);
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
		emoji: null,
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
