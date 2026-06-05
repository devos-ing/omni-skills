import {
	DEFAULT_CHAT_ISSUE_CONTENT,
	DEFAULT_CHAT_ISSUE_TITLE,
	UNTITLED_SESSION,
} from "./chat-defaults";
import { mapMessage, mapSession } from "./chat-mappers";
import {
	ensureIssueForSession,
	queueChatMessage,
	sendChatMessage,
} from "./chat-send-service";
import { resolveChatSessionWorkflowState } from "./chat-session-status";
import { appendChatMessage, updateChatSessionRow } from "./chat-writes";
import type {
	ChatRepository,
	ChatService,
	ChatServiceDeps,
	ChatSessionRecord,
	ChatSessionWorkflowState,
} from "./types/chat.types";

export function createChatService(
	repository: ChatRepository,
	deps: ChatServiceDeps,
): ChatService {
	return {
		async listSessions(workspaceId) {
			const sessions = (await repository.listSessions(workspaceId)).map(
				mapSession,
			);
			return Promise.all(
				sessions.map((session) => withWorkflowState(session, deps)),
			);
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
					archived: false,
					createdAt: now,
					updatedAt: now,
				}),
			);
		},
		async updateSession(sessionId, input) {
			const updated = await updateChatSessionRow(repository, sessionId, input);
			return updated ? mapSession(updated) : null;
		},
		async getMessages(sessionId) {
			const session = await repository.getSession(sessionId);
			if (!session) {
				return null;
			}
			return (await repository.listMessages(sessionId)).map(mapMessage);
		},
		async getSessionStatus(sessionId) {
			const session = await repository.getSession(sessionId);
			if (!session) {
				return null;
			}
			const { taskStatus, workflowState } =
				await resolveSessionWorkflowSnapshot(session, deps);
			if (session.archived) {
				return {
					sessionId: session.id,
					taskId: session.taskId,
					status: "archived",
					taskStatus,
					workflowState,
				};
			}
			const latestStatus =
				session.taskId && repository.getLatestTaskExecutionStatus
					? await repository.getLatestTaskExecutionStatus(session.taskId)
					: null;
			return {
				sessionId: session.id,
				taskId: session.taskId,
				status: latestStatus === "running" ? "running" : "idle",
				taskStatus,
				workflowState,
			};
		},
		async addMessage(sessionId, input) {
			const session = await repository.getSession(sessionId);
			if (!session) {
				return null;
			}
			const linked = await ensureIssueForSession(repository, deps, session);
			const message = await appendChatMessage(repository, sessionId, {
				...input,
				taskId: input.taskId ?? linked.issue.id,
			});
			const updatedSession = await updateChatSessionRow(
				repository,
				linked.session.id,
				{
					projectId: linked.session.projectId,
				},
			);
			return {
				message: mapMessage(message),
				session: mapSession(updatedSession ?? linked.session),
			};
		},
		async sendMessage(sessionId, input, stream) {
			return sendChatMessage(repository, deps, sessionId, input, stream);
		},
		async queueMessage(sessionId, input, stream) {
			return queueChatMessage(repository, deps, sessionId, input, stream);
		},
	};
}

async function withWorkflowState(
	session: ChatSessionRecord,
	deps: ChatServiceDeps,
): Promise<ChatSessionRecord> {
	const { workflowState } = await resolveSessionWorkflowSnapshot(session, deps);
	return { ...session, workflowState };
}

async function resolveSessionWorkflowSnapshot(
	session: { taskId: string | null },
	deps: ChatServiceDeps,
): Promise<{
	taskStatus: string | null;
	workflowState: ChatSessionWorkflowState | null;
}> {
	const issue = session.taskId ? await deps.getIssue(session.taskId) : null;
	const runState =
		issue?.projectId && deps.getWorkflowRunState
			? await deps.getWorkflowRunState(issue.projectId, issue.taskKey)
			: null;
	const taskStatus = issue?.status ?? null;
	return {
		taskStatus,
		workflowState: resolveChatSessionWorkflowState({
			runStage: runState?.stage,
			taskStatus,
		}),
	};
}
