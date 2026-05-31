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
import { queueChatMessage } from "../src/chat/chat-send-service";
import type {
	ChatRepository,
	ChatRequirementResult,
	ChatServiceDeps,
} from "../src/chat/types/chat.types";
import type { BoardTaskApiRecord } from "../src/tasks";

describe("chat send service queue", () => {
	it("waits to complete later session messages until the active send is done", async () => {
		const session = chatSession();
		const issue = boardTask();
		const messages: ChatMessageRow[] = [];
		const repository = createRepository(session, messages);
		const firstRequirement = deferred<ChatRequirementResult>();
		const resolveTaskRequirement = mock(async (input: { request: string }) => {
			if (input.request === "First request") {
				return firstRequirement.promise;
			}
			return readyRequirement("Second request");
		});
		const deps = chatDeps(issue, { resolveTaskRequirement });

		const first = await queueChatMessage(repository, deps, session.id, {
			content: "First request",
		});
		const second = await queueChatMessage(repository, deps, session.id, {
			content: "Second request",
		});
		await flushAsyncWork();

		expect(first).toBeTruthy();
		expect(second).toBeTruthy();
		expect(resolveTaskRequirement).toHaveBeenCalledTimes(1);
		expect(messages.map((message) => message.content)).toEqual([
			"First request",
			"Second request",
		]);

		firstRequirement.resolve(readyRequirement("First request"));
		await first?.completion;
		const secondResult = await second?.completion;

		expect(resolveTaskRequirement).toHaveBeenCalledTimes(2);
		expect(secondResult?.issue.title).toBe("Second request");
	});

	it("does not queue explicit clarification answers behind normal sends", async () => {
		const session = chatSession({
			pendingQuestions: JSON.stringify([{ question: "Which agent?" }]),
		});
		const issue = boardTask();
		const messages: ChatMessageRow[] = [];
		const repository = createRepository(session, messages);
		const blockedRequirement = deferred<ChatRequirementResult>();
		const resolveTaskRequirement = mock(async () => blockedRequirement.promise);
		const updateIssue = mock(async (_issueId: string, input) => ({
			...issue,
			...input,
		}));
		const deps = chatDeps(issue, { resolveTaskRequirement, updateIssue });

		const normal = await queueChatMessage(repository, deps, session.id, {
			content: "Normal follow-up",
		});
		await flushAsyncWork();
		expect(resolveTaskRequirement).toHaveBeenCalledTimes(1);

		const answer = await queueChatMessage(repository, deps, session.id, {
			content: "codex",
			answers: [{ question: "Which agent?", answer: "codex" }],
		});
		if (!answer) {
			throw new Error("Expected clarification answer to be accepted");
		}
		const answerOutcome = await Promise.race([
			answer.completion.then((result) => ({
				kind: "result" as const,
				result,
			})),
			Bun.sleep(20).then(() => ({ kind: "timeout" as const })),
		]);

		expect(answerOutcome.kind).toBe("result");
		if (answerOutcome.kind !== "result") {
			throw new Error("Expected clarification answer to complete immediately");
		}
		expect(updateIssue).toHaveBeenCalledWith(
			"task-1",
			expect.objectContaining({ status: "plan" }),
		);
		expect(answerOutcome.result?.session.pendingQuestions).toEqual([]);
		expect(resolveTaskRequirement).toHaveBeenCalledTimes(1);
		blockedRequirement.resolve(readyRequirement("Normal follow-up"));
		await normal?.completion;
	});

	it("waits to complete normal messages until the linked workflow is idle", async () => {
		const session = chatSession();
		const issue = boardTask({ status: "in_progress" });
		const messages: ChatMessageRow[] = [];
		const repository = createRepository(session, messages);
		const workflowIdle = deferred<void>();
		const waitForWorkflowIdle = mock(async () => workflowIdle.promise);
		const resolveTaskRequirement = mock(async () =>
			readyRequirement("Queued follow-up"),
		);
		const deps = chatDeps(issue, {
			resolveTaskRequirement,
			waitForWorkflowIdle,
		});

		const queued = await queueChatMessage(repository, deps, session.id, {
			content: "Queued follow-up",
		});
		await flushAsyncWork();

		expect(queued).toBeTruthy();
		expect(messages.map((message) => message.content)).toEqual([
			"Queued follow-up",
		]);
		expect(waitForWorkflowIdle).toHaveBeenCalledWith("task-1");
		expect(resolveTaskRequirement).not.toHaveBeenCalled();

		const waitingOutcome = await Promise.race([
			queued?.completion.then(() => "completed" as const),
			Bun.sleep(20).then(() => "waiting" as const),
		]);
		expect(waitingOutcome).toBe("waiting");

		workflowIdle.resolve();
		const result = await queued?.completion;

		expect(resolveTaskRequirement).toHaveBeenCalledTimes(1);
		expect(result?.issue.title).toBe("Queued follow-up");
	});
});

function createRepository(
	initialSession: ChatSessionRow,
	messages: ChatMessageRow[],
): ChatRepository {
	let session = initialSession;
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
		updateSession: async (_id: string, input: Partial<NewChatSessionRow>) => {
			session = { ...session, ...input };
			return session;
		},
	};
}

function chatDeps(
	issue: BoardTaskApiRecord,
	overrides: Partial<ChatServiceDeps>,
): ChatServiceDeps {
	return {
		ensureDefaultProject: async () => defaultProject(),
		createIssue: async () => issue,
		getIssue: async () => issue,
		resolveTaskRequirement: async () => readyRequirement("Ready"),
		updateIssue: async (_issueId, input) => ({ ...issue, ...input }),
		...overrides,
	};
}

function readyRequirement(title: string): ChatRequirementResult {
	return {
		status: "ready",
		task: { title, description: title },
	};
}

function deferred<T>(): {
	promise: Promise<T>;
	resolve(value: T): void;
} {
	let resolve: (value: T) => void = () => {};
	const promise = new Promise<T>((innerResolve) => {
		resolve = innerResolve;
	});
	return { promise, resolve };
}

async function flushAsyncWork(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
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

function boardTask(
	overrides: Partial<BoardTaskApiRecord> = {},
): BoardTaskApiRecord {
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
		...overrides,
	};
}

function defaultProject(): BoardProjectRow {
	return {
		id: "default",
		boardId: "board-1",
		externalProjectId: null,
		name: "Default Project",
		emoji: null,
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
