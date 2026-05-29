import { describe, expect, it, mock } from "bun:test";
import type {
	BoardProjectRow,
	ChatMessageRow,
	ChatSessionRow,
	NewChatMessageRow,
	NewChatSessionRow,
} from "devos-db";
import {
	DEFAULT_CHAT_ISSUE_CONTENT,
	DEFAULT_CHAT_ISSUE_TITLE,
} from "../src/chat/chat-defaults";
import { sendChatMessage } from "../src/chat/chat-send-service";
import type {
	ChatRepository,
	ChatSendStreamCallbacks,
	ChatServiceDeps,
} from "../src/chat/types/chat.types";
import type { BoardTaskApiRecord } from "../src/tasks";

describe("chat send service streaming", () => {
	it("preserves recommended options in pending clarification questions", async () => {
		const session = chatSession();
		const issue = boardTask();
		const messages: ChatMessageRow[] = [];
		const repository = createRepository(session, messages);
		const deps: ChatServiceDeps = {
			ensureDefaultProject: async () => defaultProject(),
			createIssue: async () => issue,
			getIssue: async () => issue,
			resolveTaskRequirement: async () => ({
				status: "needs_info",
				questions: [
					{
						question: "Which agent?",
						options: [
							{ label: "Codex", value: "codex", recommended: true },
							{ label: "Claude", value: "claude", recommended: false },
						],
					},
				],
			}),
			updateIssue: async (_issueId, input) => ({ ...issue, ...input }),
		};

		const result = await sendChatMessage(repository, deps, session.id, {
			content: "Route agent choice",
		});

		expect(result?.session.pendingQuestions).toEqual([
			{
				question: "Which agent?",
				options: [
					{ label: "Codex", value: "codex", recommended: true },
					{ label: "Claude", value: "claude" },
				],
			},
		]);
	});

	it("emits stream error after a durable user message when send fails", async () => {
		const session = chatSession();
		const issue = boardTask();
		const messages: ChatMessageRow[] = [];
		const events: Array<{ type: string; error?: string }> = [];
		const repository = createRepository(session, messages);
		const deps: ChatServiceDeps = {
			ensureDefaultProject: async () => defaultProject(),
			createIssue: async () => issue,
			getIssue: async () => issue,
			resolveTaskRequirement: async () => ({
				status: "ready",
				task: { title: "Build it", description: "Build it" },
			}),
			updateIssue: async () => {
				throw new Error("update exploded");
			},
		};
		const stream: ChatSendStreamCallbacks = {
			runId: "run-1",
			onStreamError: (payload) =>
				events.push({ type: "error", error: payload.error }),
			onStreamStarted: () => events.push({ type: "started" }),
			onUserMessage: () => events.push({ type: "message" }),
		};

		await expect(
			sendChatMessage(
				repository,
				deps,
				session.id,
				{ content: "Build it" },
				stream,
			),
		).rejects.toThrow("update exploded");

		expect(messages).toHaveLength(1);
		expect(messages[0]).toMatchObject({ role: "user", content: "Build it" });
		expect(events).toEqual([
			{ type: "message" },
			{ type: "started" },
			{ type: "error", error: "update exploded" },
		]);
	});

	it("accepts workflow clarification answers without rerunning task intake", async () => {
		const session = chatSession({
			pendingQuestions: JSON.stringify([
				{
					question: "Which boundary owns this?",
					options: [
						{
							label: "Workflow phase",
							value: "workflow phase",
							recommended: true,
						},
					],
				},
			]),
		});
		const issue = boardTask();
		const messages: ChatMessageRow[] = [];
		const repository = createRepository(session, messages);
		const resolveTaskRequirement = mock(async () => ({
			status: "ready" as const,
			task: { title: "unused", description: "unused" },
		}));
		const updateIssue = mock(async (_issueId: string, input) => ({
			...issue,
			...input,
		}));
		const deps: ChatServiceDeps = {
			ensureDefaultProject: async () => defaultProject(),
			createIssue: async () => issue,
			getIssue: async () => issue,
			resolveTaskRequirement,
			updateIssue,
		};

		const result = await sendChatMessage(repository, deps, session.id, {
			content: "workflow phase",
			answers: [
				{
					question: "Which boundary owns this?",
					answer: "workflow phase",
				},
			],
		});

		expect(resolveTaskRequirement).not.toHaveBeenCalled();
		expect(updateIssue).toHaveBeenCalledWith(
			"task-1",
			expect.objectContaining({ status: "plan" }),
		);
		expect(result?.session.pendingQuestions).toEqual([]);
		expect(result?.session.pendingRequest).toBeNull();
		expect(result?.messages.at(-1)).toMatchObject({ role: "assistant" });
	});
});

function createRepository(
	session: ChatSessionRow,
	messages: ChatMessageRow[],
): ChatRepository {
	return {
		addMessage: async (_sessionId: string, message: NewChatMessageRow) => {
			const row: ChatMessageRow = {
				...message,
				commandAction: message.commandAction ?? null,
				metadata: message.metadata ?? null,
				taskId: message.taskId ?? null,
			};
			messages.push(row);
			return row;
		},
		createSession: async (input: NewChatSessionRow) => input as ChatSessionRow,
		getSession: async () => session,
		getSessionByTaskId: async () => session,
		listMessages: async () => messages,
		listSessions: async () => [session],
		updateSession: async (_id: string, input: Partial<NewChatSessionRow>) => ({
			...session,
			...input,
		}),
	};
}

function chatSession(overrides: Partial<ChatSessionRow> = {}): ChatSessionRow {
	return {
		id: "session-1",
		workspaceId: "owner-1",
		projectId: "default",
		taskId: "task-1",
		title: "Untitled",
		pendingRequest: null,
		pendingQuestions: null,
		archived: false,
		createdAt: "2026-05-16T00:00:00.000Z",
		updatedAt: "2026-05-16T00:00:00.000Z",
		...overrides,
	};
}

function boardTask(): BoardTaskApiRecord {
	return {
		id: "task-1",
		taskKey: "OWN-1",
		projectId: "default",
		title: DEFAULT_CHAT_ISSUE_TITLE,
		content: DEFAULT_CHAT_ISSUE_CONTENT,
		priority: 0,
		status: "planning",
		dueDate: null,
		creatorId: "owner-1",
		assigneeId: null,
		linkedPr: null,
		createdAt: "2026-05-16T00:00:00.000Z",
		updatedAt: "2026-05-16T00:00:00.000Z",
	};
}

function defaultProject(): BoardProjectRow {
	return {
		id: "default",
		boardId: "board-1",
		externalProjectId: null,
		name: "Default Project",
		description: null,
		ownerId: "owner-1",
		repoOwner: null,
		repoName: null,
		baseBranch: null,
		localFolder: null,
		lead: null,
		category: null,
		priority: null,
		createdAt: "2026-05-16T00:00:00.000Z",
		updatedAt: "2026-05-16T00:00:00.000Z",
	};
}
