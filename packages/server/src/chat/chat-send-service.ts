import type { ChatSessionRow } from "devos-db";
import type { BoardTaskApiRecord } from "../tasks";
import { collectClarificationAnswers } from "./chat-answer-metadata";
import {
	DEFAULT_CHAT_ISSUE_CONTENT,
	DEFAULT_CHAT_ISSUE_TITLE,
} from "./chat-defaults";
import { mapMessage, mapSession } from "./chat-mappers";
import {
	applyRequirementResult,
	updateSessionAfterRequirement,
} from "./chat-requirement-result";
import {
	completeWorkflowClarificationAnswer,
	shouldCompleteWorkflowClarification,
} from "./chat-workflow-clarification";
import { appendChatMessage, updateChatSessionRow } from "./chat-writes";
import type {
	ChatMessageRecord,
	ChatQueuedSendResult,
	ChatRepository,
	ChatSendAnswer,
	ChatSendInput,
	ChatSendResult,
	ChatSendStreamCallbacks,
	ChatServiceDeps,
} from "./types/chat.types";

interface AcceptedChatSend {
	answers: ChatSendAnswer[];
	issue: BoardTaskApiRecord;
	requestText: string;
	session: ChatSessionRow;
	userRecord: ChatMessageRecord;
}

export async function queueChatMessage(
	repository: ChatRepository,
	deps: ChatServiceDeps,
	sessionId: string,
	input: ChatSendInput,
	stream?: ChatSendStreamCallbacks,
): Promise<ChatQueuedSendResult | null> {
	const accepted = await acceptChatMessage(
		repository,
		deps,
		sessionId,
		input,
		stream,
	);
	if (!accepted) {
		return null;
	}
	return {
		accepted: {
			issue: accepted.issue,
			messages: [accepted.userRecord],
			session: mapSession(accepted.session),
		},
		completion: completeChatMessage(
			repository,
			deps,
			sessionId,
			accepted,
			stream,
		),
	};
}

export async function sendChatMessage(
	repository: ChatRepository,
	deps: ChatServiceDeps,
	sessionId: string,
	input: ChatSendInput,
	stream?: ChatSendStreamCallbacks,
): Promise<ChatSendResult | null> {
	const queued = await queueChatMessage(
		repository,
		deps,
		sessionId,
		input,
		stream,
	);
	return queued ? queued.completion : null;
}

async function acceptChatMessage(
	repository: ChatRepository,
	deps: ChatServiceDeps,
	sessionId: string,
	input: ChatSendInput,
	stream?: ChatSendStreamCallbacks,
): Promise<AcceptedChatSend | null> {
	const session = await repository.getSession(sessionId);
	if (!session) {
		return null;
	}
	const linked = await ensureIssueForSession(repository, deps, session);
	const userMessage = await appendChatMessage(repository, sessionId, {
		content: input.content,
		kind: input.answers?.length ? "clarification" : "message",
		metadata: input.answers ? { answers: input.answers } : null,
		role: "user",
		taskId: linked.issue.id,
	});
	const userRecord = mapMessage(userMessage);
	stream?.onUserMessage?.(userRecord);
	stream?.onStreamStarted?.({
		runId: stream.runId,
		sessionId,
		status: "loading",
		userMessageId: userRecord.id,
	});
	return {
		answers: input.answers ?? [],
		issue: linked.issue,
		requestText: linked.session.pendingRequest ?? input.content.trim(),
		session: linked.session,
		userRecord,
	};
}

async function completeChatMessage(
	repository: ChatRepository,
	deps: ChatServiceDeps,
	sessionId: string,
	accepted: AcceptedChatSend,
	stream?: ChatSendStreamCallbacks,
): Promise<ChatSendResult> {
	try {
		if (shouldCompleteWorkflowClarification(accepted)) {
			return completeWorkflowClarificationAnswer({
				repository,
				deps,
				sessionId,
				accepted,
				stream,
			});
		}
		const requirement = await deps.resolveTaskRequirement({
			request: accepted.requestText,
			projectId:
				accepted.session.projectId ?? accepted.issue.projectId ?? undefined,
			answers: await collectClarificationAnswers(repository, sessionId),
		});
		const outcome = await applyRequirementResult(
			deps,
			accepted.issue,
			accepted.session,
			accepted.requestText,
			requirement,
		);
		const updatedSession = await updateSessionAfterRequirement(
			repository,
			accepted.session,
			outcome.sessionUpdate,
		);
		const assistantChunks = [outcome.assistantText];
		for (const delta of assistantChunks) {
			stream?.onStreamDelta?.({ delta, runId: stream.runId, sessionId });
		}
		const assistantMessage = await appendChatMessage(repository, sessionId, {
			content: assistantChunks.join(""),
			kind: outcome.assistantKind,
			metadata: { runId: stream?.runId ?? null },
			role: "assistant",
			taskId: outcome.issue.id,
		});
		const assistantRecord = mapMessage(assistantMessage);
		stream?.onStreamCompleted?.({
			message: assistantRecord,
			runId: stream.runId,
			sessionId,
		});
		stream?.onAssistantMessage?.(assistantRecord);
		return {
			issue: outcome.issue,
			session: mapSession(updatedSession),
			messages: [accepted.userRecord, assistantRecord],
		};
	} catch (error) {
		stream?.onStreamError?.({
			error: error instanceof Error ? error.message : String(error),
			runId: stream.runId,
			sessionId,
		});
		throw error;
	}
}

export async function ensureIssueForSession(
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
		const updated = await updateChatSessionRow(repository, session.id, {
			projectId,
		});
		return { issue: existingIssue, session: updated ?? session };
	}
	const projectId = session.projectId ?? (await deps.ensureDefaultProject()).id;
	const issue = await deps.createIssue({
		content: DEFAULT_CHAT_ISSUE_CONTENT,
		projectId,
		title: DEFAULT_CHAT_ISSUE_TITLE,
	});
	const updated = await updateChatSessionRow(repository, session.id, {
		projectId,
		taskId: issue.id,
	});
	return {
		issue,
		session: updated ?? { ...session, projectId, taskId: issue.id },
	};
}
