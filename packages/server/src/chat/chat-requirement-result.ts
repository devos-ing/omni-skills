import type { ChatSessionRow } from "devos-db";
import type { BoardTaskApiRecord } from "../tasks";
import { UNTITLED_SESSION } from "./chat-defaults";
import { titleFromMessage } from "./chat-mappers";
import { updateChatSessionRow } from "./chat-writes";
import type {
	ChatClarificationQuestion,
	ChatRepository,
	ChatRequirementApplicationResult,
	ChatServiceDeps,
	ChatSessionUpdateInput,
} from "./types/chat.types";

export async function updateSessionAfterRequirement(
	repository: ChatRepository,
	session: ChatSessionRow,
	input: ChatSessionUpdateInput,
): Promise<ChatSessionRow> {
	return (
		(await updateChatSessionRow(repository, session.id, input)) ??
		(await repository.getSession(session.id)) ??
		session
	);
}

export async function applyRequirementResult(
	deps: ChatServiceDeps,
	issue: BoardTaskApiRecord,
	session: ChatSessionRow,
	requestText: string,
	requirement: Awaited<ReturnType<ChatServiceDeps["resolveTaskRequirement"]>>,
): Promise<ChatRequirementApplicationResult> {
	if (requirement.status === "needs_info") {
		const updatedIssue = await deps.updateIssue(issue.id, {
			status: "backlog",
		});
		return {
			assistantKind: "clarification",
			assistantText: clarificationText(requirement.questions),
			issue: updatedIssue,
			sessionUpdate: {
				pendingRequest: requestText,
				pendingQuestions: requirement.questions,
				...(session.title === UNTITLED_SESSION
					? { title: titleFromMessage(requestText) }
					: {}),
			},
		};
	}
	const updatedIssue = await deps.updateIssue(issue.id, {
		content: requirement.task.description,
		status: "plan",
		title: requirement.task.title,
	});
	return {
		assistantKind: "task",
		assistantText: `Task ${updatedIssue.taskKey}: ${updatedIssue.title} is ready for planning.`,
		issue: updatedIssue,
		sessionUpdate: {
			pendingRequest: null,
			pendingQuestions: null,
			title: requirement.task.title,
		},
	};
}

function clarificationText(questions: ChatClarificationQuestion[]): string {
	const currentQuestion = questions[0];
	if (!currentQuestion) {
		return "I need a bit more detail before this is ready for planning.";
	}
	return [
		"I need a bit more detail before this is ready for planning:",
		formatClarificationQuestion(currentQuestion),
	].join("\n");
}

function formatClarificationQuestion(
	question: ChatClarificationQuestion,
): string {
	const options = question.options?.length
		? question.options
				.map((option) => `  - ${option.label}: ${option.value}`)
				.join("\n")
		: "";
	return options
		? `- ${question.question}\n${options}`
		: `- ${question.question}`;
}
