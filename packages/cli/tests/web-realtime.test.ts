import { describe, expect, it } from "bun:test";
import type {
	InboxMessageRecord,
	ProjectBoardTaskRecord,
	WorkspaceProjectRecord,
} from "../../web/src/lib/api";
import { serverStateQueryKeys } from "../../web/src/lib/api/query-keys";
import { parseRealtimeEvent } from "../../web/src/lib/realtime/realtime-client";
import { applyRealtimeEventToQueryClient } from "../../web/src/lib/realtime/realtime-query-bridge";
import {
	applyRealtimeEvent,
	inboxScopeKey,
} from "../../web/src/lib/realtime/realtime-store";
import type {
	RealtimeEvent,
	RealtimeIssueEventType,
	RealtimeProjectEventType,
} from "../../web/src/lib/realtime/types/realtime-events.types";
import type { RealtimeStoreState } from "../../web/src/lib/realtime/types/realtime-store.types";

describe("web realtime client", () => {
	it("parses realtime event frames and rejects malformed payloads", () => {
		const event = parseRealtimeEvent(
			JSON.stringify({
				id: "event-1",
				emittedAt: "2026-05-16T00:00:00.000Z",
				type: "issue.created",
				issue: taskRecord({ id: "task-1" }),
			}),
		);

		expect(event).toMatchObject({
			type: "issue.created",
			issue: { id: "task-1" },
		});
		expect(() =>
			parseRealtimeEvent(JSON.stringify({ type: "unknown" })),
		).toThrow("Invalid realtime event field 'id'");
	});

	it("applies issue, project, and inbox events to the realtime store", () => {
		const initial = emptyState();
		const withIssue = applyRealtimeEvent(initial, issueEvent("issue.created"));
		const withProject = applyRealtimeEvent(
			withIssue,
			projectEvent("project.created"),
		);
		const withMessage = applyRealtimeEvent(withProject, inboxEvent());

		expect(withMessage.issuesById["task-1"]?.title).toBe("Task");
		expect(withMessage.projectsById["project-1"]?.workspaceId).toBe("owner-1");
		expect(
			withMessage.inboxMessagesByScope[inboxScopeKey(messageRecord())],
		).toHaveLength(1);

		const afterDelete = applyRealtimeEvent(
			withMessage,
			issueEvent("issue.deleted"),
		);
		expect(afterDelete.issuesById["task-1"]).toBeUndefined();
	});

	it("bridges realtime events into React Query caches", () => {
		const queryClient = new FakeQueryClient();
		const task = taskRecord({ id: "task-1" });
		const project = projectRecord({ id: "project-1" });
		const message = messageRecord();

		applyRealtimeEventToQueryClient(
			queryClient as never,
			issueEvent("issue.created"),
		);
		applyRealtimeEventToQueryClient(
			queryClient as never,
			projectEvent("project.created"),
		);
		applyRealtimeEventToQueryClient(queryClient as never, inboxEvent());

		expect(
			queryClient.getQueryData<ProjectBoardTaskRecord[]>(
				serverStateQueryKeys.boardTasks,
			),
		).toEqual([task]);
		expect(
			queryClient.getQueryData<WorkspaceProjectRecord[]>(
				serverStateQueryKeys.workspaceProjects(project.workspaceId),
			),
		).toEqual([project]);
		expect(
			queryClient.getQueryData<InboxMessageRecord[]>(
				serverStateQueryKeys.inboxMessages(message),
			),
		).toEqual([message]);

		applyRealtimeEventToQueryClient(
			queryClient as never,
			issueEvent("issue.deleted"),
		);
		expect(
			queryClient.getQueryData<ProjectBoardTaskRecord[]>(
				serverStateQueryKeys.boardTasks,
			),
		).toEqual([]);
	});
});

function emptyState(): RealtimeStoreState {
	return {
		status: "idle",
		lastError: null,
		lastEvent: null,
		chatStreamsByRunId: {},
		issuesById: {},
		projectsById: {},
		inboxMessagesByScope: {},
	};
}

class FakeQueryClient {
	private readonly data = new Map<string, unknown>();

	getQueryData<T>(queryKey: readonly unknown[]): T | undefined {
		return this.data.get(JSON.stringify(queryKey)) as T | undefined;
	}

	setQueryData<T>(
		queryKey: readonly unknown[],
		value: T | ((current: T | undefined) => T),
	): void {
		const key = JSON.stringify(queryKey);
		const current = this.data.get(key) as T | undefined;
		this.data.set(
			key,
			typeof value === "function"
				? (value as (current: T | undefined) => T)(current)
				: value,
		);
	}

	removeQueries({ queryKey }: { queryKey: readonly unknown[] }): void {
		this.data.delete(JSON.stringify(queryKey));
	}

	invalidateQueries(): Promise<void> {
		return Promise.resolve();
	}
}

function issueEvent(type: RealtimeIssueEventType): RealtimeEvent {
	return {
		id: `event-${type}`,
		emittedAt: "2026-05-16T00:00:00.000Z",
		type,
		issue: taskRecord({ id: "task-1" }),
	};
}

function projectEvent(type: RealtimeProjectEventType): RealtimeEvent {
	return {
		id: `event-${type}`,
		emittedAt: "2026-05-16T00:00:00.000Z",
		type,
		project: projectRecord({ id: "project-1" }),
	};
}

function inboxEvent(): RealtimeEvent {
	return {
		id: "event-inbox",
		emittedAt: "2026-05-16T00:00:00.000Z",
		type: "inbox.message.created",
		message: messageRecord(),
	};
}

function taskRecord(
	overrides: Partial<ProjectBoardTaskRecord> = {},
): ProjectBoardTaskRecord {
	return {
		id: "task-1",
		taskKey: "TASK-000001",
		projectId: null,
		title: "Task",
		content: "Body",
		priority: 1,
		status: "open",
		dueDate: null,
		creatorId: "owner-1",
		assigneeId: null,
		linkedPr: null,
		createdAt: "2026-05-16T00:00:00.000Z",
		updatedAt: "2026-05-16T00:00:00.000Z",
		...overrides,
	};
}

function projectRecord(
	overrides: Partial<WorkspaceProjectRecord> = {},
): WorkspaceProjectRecord {
	return {
		id: "project-1",
		boardId: "board-1",
		workspaceId: "owner-1",
		externalProjectId: null,
		name: "Project",
		emoji: null,
		description: null,
		repoOwner: null,
		repoName: null,
		baseBranch: null,
		localFolder: null,
		lead: null,
		category: null,
		priority: null,
		createdAt: "2026-05-16T00:00:00.000Z",
		updatedAt: "2026-05-16T00:00:00.000Z",
		...overrides,
	};
}

function messageRecord(): InboxMessageRecord {
	return {
		id: "message-1",
		workspaceId: "workspace-1",
		userId: "user-1",
		runId: "run-1",
		source: "agent_workflow_event",
		kind: "agent_message",
		body: "Done",
		taskId: null,
		agentId: null,
		metadata: null,
		createdAt: "2026-05-16T00:00:00.000Z",
	};
}
