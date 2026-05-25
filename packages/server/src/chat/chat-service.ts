import type { ChatMessageRow, ChatSessionRow } from "devos-db";
import type { BoardTaskApiRecord } from "../tasks";
import {
	DEFAULT_CHAT_ISSUE_CONTENT,
	DEFAULT_CHAT_ISSUE_TITLE,
	UNTITLED_SESSION,
} from "./chat-defaults";
import { mapMessage, mapSession, titleFromMessage } from "./chat-mappers";
import type {
	ChatMessageCreateInput,
	ChatRepository,
	ChatSendInput,
	ChatSendResult,
	ChatService,
	ChatServiceDeps,
	ChatSessionIssueUpdateInput,
	ChatSessionUpdateInput,
} from "./types/chat.types";

export function createChatService(
	repository: ChatRepository,
	deps: ChatServiceDeps,
): ChatService {
	return {
		async listSessions(workspaceId) {
			return (await repository.listSessions(workspaceId)).map(mapSession);
		},
		async createSession(input) {
			const projectId =
				input.projectId ?? (await deps.ensureDefaultProject()).id;
			const issue = await deps.createIssue({
				content: DEFAULT_CHAT_ISSUE_CONTENT,
				projectId,
				title: DEFAULT_CHAT_ISSUE_TITLE,
			});
			const now = new Date().toISOString();
			return mapSession(
				await repository.createSession({
					id: crypto.randomUUID(),
					workspaceId: input.workspaceId,
					projectId,
					taskId: issue.id,
					title: input.title?.trim() || UNTITLED_SESSION,
					pendingRequest: null,
					pendingQuestions: null,
					createdAt: now,
					updatedAt: now,
				}),
			);
		},
		async updateSession(sessionId, input) {
			const updated = await updateSession(repository, sessionId, input);
			return updated ? mapSession(updated) : null;
		},
		async getMessages(sessionId) {
			const session = await repository.getSession(sessionId);
			if (!session) {
				return null;
			}
			return (await repository.listMessages(sessionId)).map(mapMessage);
		},
		async addMessage(sessionId, input) {
			const session = await repository.getSession(sessionId);
			if (!session) {
				return null;
			}
			const linked = await ensureIssueForSession(repository, deps, session);
			const message = await appendMessage(repository, sessionId, {
				...input,
				taskId: input.taskId ?? linked.issue.id,
			});
			await repository.updateSession(linked.session.id, {
				updatedAt: new Date().toISOString(),
			});
			return mapMessage(message);
		},
		async sendMessage(sessionId, input) {
			return sendMessage(repository, deps, sessionId, input);
		},
	};
}

async function sendMessage(
	repository: ChatRepository,
	deps: ChatServiceDeps,
	sessionId: string,
	input: ChatSendInput,
): Promise<ChatSendResult | null> {
	const session = await repository.getSession(sessionId);
	if (!session) {
		return null;
	}
	const linked = await ensureIssueForSession(repository, deps, session);
	const userMessage = await appendMessage(repository, sessionId, {
		content: input.content,
		kind: input.answers?.length ? "clarification" : "message",
		metadata: input.answers ? { answers: input.answers } : null,
		role: "user",
		taskId: linked.issue.id,
	});
	const issue = await updateIssueAfterMessage(deps, linked.issue, input);
	const updatedSession = await updateSessionAfterMessage(
		repository,
		linked.session,
		input,
	);
	return {
		issue,
		session: mapSession(updatedSession),
		messages: [userMessage].map(mapMessage),
	};
}

async function ensureIssueForSession(
	repository: ChatRepository,
	deps: ChatServiceDeps,
	session: ChatSessionRow,
): Promise<{ issue: BoardTaskApiRecord; session: ChatSessionRow }> {
	const existingIssue = session.taskId
		? await deps.getIssue(session.taskId)
		: null;
	if (existingIssue) {
		const projectId =
			session.projectId ??
			existingIssue.projectId ??
			(await deps.ensureDefaultProject()).id;
		if (session.projectId === projectId) {
			return { issue: existingIssue, session };
		}
		const updated = await repository.updateSession(session.id, {
			projectId,
			updatedAt: new Date().toISOString(),
		});
		return { issue: existingIssue, session: updated ?? session };
	}
	const projectId = session.projectId ?? (await deps.ensureDefaultProject()).id;
	const issue = await deps.createIssue({
		content: DEFAULT_CHAT_ISSUE_CONTENT,
		projectId,
		title: DEFAULT_CHAT_ISSUE_TITLE,
	});
	const updated = await repository.updateSession(session.id, {
		projectId,
		taskId: issue.id,
		updatedAt: new Date().toISOString(),
	});
	return {
		issue,
		session: updated ?? { ...session, projectId, taskId: issue.id },
	};
}

async function updateSessionAfterMessage(
	repository: ChatRepository,
	session: ChatSessionRow,
	input: ChatSendInput,
): Promise<ChatSessionRow> {
	const update: ChatSessionUpdateInput = {
		pendingRequest: null,
		pendingQuestions: null,
	};
	if (session.title === UNTITLED_SESSION && input.content.trim()) {
		update.title = titleFromMessage(input.content);
	}
	return (
		(await updateSession(repository, session.id, update)) ??
		(await repository.getSession(session.id)) ??
		session
	);
}

async function updateIssueAfterMessage(
	deps: ChatServiceDeps,
	issue: BoardTaskApiRecord,
	input: ChatSendInput,
): Promise<BoardTaskApiRecord> {
	const issueUpdate = issueUpdateFromMessage(issue, input.content);
	return issueUpdate ? deps.updateIssue(issue.id, issueUpdate) : issue;
}

function issueUpdateFromMessage(
	issue: BoardTaskApiRecord,
	content: string,
): ChatSessionIssueUpdateInput | null {
	const trimmed = content.trim();
	if (
		!trimmed ||
		issue.title !== DEFAULT_CHAT_ISSUE_TITLE ||
		issue.content !== DEFAULT_CHAT_ISSUE_CONTENT
	) {
		return null;
	}
	return {
		content: trimmed,
		title: titleFromMessage(trimmed),
	};
}

async function appendMessage(
	repository: ChatRepository,
	sessionId: string,
	input: ChatMessageCreateInput,
): Promise<ChatMessageRow> {
	const now = new Date().toISOString();
	return repository.addMessage(sessionId, {
		id: crypto.randomUUID(),
		sessionId,
		role: input.role,
		kind: input.kind ?? "message",
		content: input.content,
		taskId: input.taskId ?? null,
		commandAction: input.commandAction ?? null,
		metadata: input.metadata ? JSON.stringify(input.metadata) : null,
		createdAt: now,
	});
}

async function updateSession(
	repository: ChatRepository,
	sessionId: string,
	input: ChatSessionUpdateInput,
): Promise<ChatSessionRow | null> {
	const update: Partial<ChatSessionRow> = {
		updatedAt: new Date().toISOString(),
	};
	if (input.title !== undefined) {
		update.title = input.title.trim() || UNTITLED_SESSION;
	}
	if (input.projectId !== undefined) {
		update.projectId = input.projectId;
	}
	if (input.taskId !== undefined) {
		update.taskId = input.taskId;
	}
	if (input.pendingRequest !== undefined) {
		update.pendingRequest = input.pendingRequest;
	}
	if (input.pendingQuestions !== undefined) {
		update.pendingQuestions = input.pendingQuestions
			? JSON.stringify(input.pendingQuestions)
			: null;
	}
	return repository.updateSession(sessionId, update);
}
