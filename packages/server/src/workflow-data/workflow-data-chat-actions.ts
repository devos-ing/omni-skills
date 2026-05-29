import { collectClarificationAnswers } from "../chat/chat-answer-metadata";
import { mapMessage, mapSession } from "../chat/chat-mappers";
import { createChatRepository } from "../chat/chat-repository";
import { appendChatMessage, updateChatSessionRow } from "../chat/chat-writes";
import type { ChatClarificationQuestion } from "../chat/types/chat.types";
import type { WorkflowChatClarificationQuestion } from "./types/workflow-data.types";
import type { WorkflowDataContext } from "./workflow-data-actions";
import { workflowError } from "./workflow-data-error";

export async function publishChatClarification(
	context: WorkflowDataContext,
	input: { taskId: string; questions: WorkflowChatClarificationQuestion[] },
): Promise<{ published: true }> {
	const repository = createChatRepository(context.db);
	const session = await repository.getSessionByTaskId(input.taskId);
	if (!session) {
		throw workflowError("not_found", "Chat session not found for task");
	}
	const questions = normalizeQuestions(input.questions);
	if (questions.length === 0) {
		throw workflowError("invalid_payload", "Clarification questions are empty");
	}
	const updatedTask = await context.taskService.updateTask(input.taskId, {
		status: "backlog",
	});
	if (updatedTask.status !== "ok") {
		throw workflowError(updatedTask.status, "Task update failed");
	}
	const updatedSession = await updateChatSessionRow(repository, session.id, {
		pendingRequest: null,
		pendingQuestions: questions,
	});
	const message = await appendChatMessage(repository, session.id, {
		content: questions[0]?.question ?? "Clarification needed.",
		kind: "clarification",
		metadata: { source: "brainstorm" },
		role: "assistant",
		taskId: input.taskId,
	});
	context.realtimeEvents?.publish({
		type: "issue.updated",
		issue: updatedTask.value,
	});
	context.realtimeEvents?.publish({
		type: "chat.session.updated",
		session: mapSession(updatedSession ?? session),
	});
	context.realtimeEvents?.publish({
		type: "chat.message.created",
		message: mapMessage(message),
	});
	return { published: true };
}

export async function listChatClarificationAnswers(
	context: WorkflowDataContext,
	input: { taskId: string },
) {
	const repository = createChatRepository(context.db);
	const session = await repository.getSessionByTaskId(input.taskId);
	return session ? collectClarificationAnswers(repository, session.id) : [];
}

function normalizeQuestions(
	questions: WorkflowChatClarificationQuestion[],
): ChatClarificationQuestion[] {
	return questions.flatMap((question) => {
		const text = question.question?.trim();
		if (!text) {
			return [];
		}
		const options = question.options?.flatMap((option) => {
			const value = option.value?.trim();
			if (!value) {
				return [];
			}
			const label = option.label?.trim() || value;
			const description = option.description?.trim();
			return [
				{
					label,
					value,
					...(description ? { description } : {}),
					...(option.recommended === true ? { recommended: true } : {}),
				},
			];
		});
		return [{ question: text, ...(options?.length ? { options } : {}) }];
	});
}
