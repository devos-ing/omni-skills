import type { ChatSessionRow } from "devos-db";
import type { BoardTaskApiRecord } from "../tasks";
import { mapMessage, mapSession } from "./chat-mappers";
import { appendChatMessage, updateChatSessionRow } from "./chat-writes";
import type {
	ChatMessageRecord,
	ChatRepository,
	ChatSendAnswer,
	ChatSendResult,
	ChatSendStreamCallbacks,
	ChatServiceDeps,
} from "./types/chat.types";

interface AcceptedWorkflowClarification {
	answers: ChatSendAnswer[];
	issue: BoardTaskApiRecord;
	session: ChatSessionRow;
	userRecord: ChatMessageRecord;
}

export function shouldCompleteWorkflowClarification(
	accepted: AcceptedWorkflowClarification,
): boolean {
	return (
		accepted.answers.length > 0 &&
		accepted.session.pendingRequest === null &&
		Boolean(accepted.session.pendingQuestions)
	);
}

export async function completeWorkflowClarificationAnswer(input: {
	repository: ChatRepository;
	deps: ChatServiceDeps;
	sessionId: string;
	accepted: AcceptedWorkflowClarification;
	stream?: ChatSendStreamCallbacks;
}): Promise<ChatSendResult> {
	const issue = await input.deps.updateIssue(input.accepted.issue.id, {
		status: "plan",
	});
	const updatedSession = await updateChatSessionRow(
		input.repository,
		input.sessionId,
		{
			pendingRequest: null,
			pendingQuestions: null,
		},
	);
	const assistantText = "Thanks, I'll continue from that answer.";
	input.stream?.onStreamDelta?.({
		delta: assistantText,
		runId: input.stream.runId,
		sessionId: input.sessionId,
	});
	const assistantMessage = await appendChatMessage(
		input.repository,
		input.sessionId,
		{
			content: assistantText,
			kind: "clarification",
			metadata: { runId: input.stream?.runId ?? null, source: "brainstorm" },
			role: "assistant",
			taskId: issue.id,
		},
	);
	const assistantRecord = mapMessage(assistantMessage);
	input.stream?.onStreamCompleted?.({
		message: assistantRecord,
		runId: input.stream.runId,
		sessionId: input.sessionId,
	});
	input.stream?.onAssistantMessage?.(assistantRecord);
	return {
		issue,
		session: mapSession(updatedSession ?? input.accepted.session),
		messages: [input.accepted.userRecord, assistantRecord],
	};
}
