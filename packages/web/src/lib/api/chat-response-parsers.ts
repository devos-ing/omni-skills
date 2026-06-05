import {
	assertObjectRecord,
	parseListResponse,
	readBoolean,
	readNullableString,
	readString,
} from "./response-utils";
import { parseProjectBoardTaskRecord } from "./task-client";
import type {
	ChatMessageRecord,
	ChatSendResponse,
	ChatSessionRecord,
	ChatSessionWorkflowState,
} from "./types/chat.types";
import type {
	TaskClarificationOption,
	TaskClarificationQuestion,
} from "./types/task.types";

const CHAT_SESSIONS_PATH = "/api/chat/sessions";
const CHAT_SESSION_WORKFLOW_STATES = [
	"brainstorm",
	"plan",
	"implement",
	"testing",
	"done",
	"failed",
	"canceled",
] as const;

export function parseChatSessionRecord(payload: unknown): ChatSessionRecord {
	const row = assertObjectRecord(payload, CHAT_SESSIONS_PATH);
	return {
		id: readString(row, "id", CHAT_SESSIONS_PATH),
		workspaceId: readString(row, "workspaceId", CHAT_SESSIONS_PATH),
		projectId: readNullableString(row, "projectId", CHAT_SESSIONS_PATH),
		taskId: readNullableString(row, "taskId", CHAT_SESSIONS_PATH),
		title: readString(row, "title", CHAT_SESSIONS_PATH),
		pendingRequest: readNullableString(
			row,
			"pendingRequest",
			CHAT_SESSIONS_PATH,
		),
		pendingQuestions: readQuestionList(row.pendingQuestions),
		archived:
			"archived" in row
				? readBoolean(row, "archived", CHAT_SESSIONS_PATH)
				: false,
		workflowState: readChatSessionWorkflowState(row),
		createdAt: readString(row, "createdAt", CHAT_SESSIONS_PATH),
		updatedAt: readString(row, "updatedAt", CHAT_SESSIONS_PATH),
	};
}

export function parseChatMessageRecord(payload: unknown): ChatMessageRecord {
	const row = assertObjectRecord(payload, `${CHAT_SESSIONS_PATH}/:id/messages`);
	return {
		id: readString(row, "id", CHAT_SESSIONS_PATH),
		sessionId: readString(row, "sessionId", CHAT_SESSIONS_PATH),
		role: readEnum(row.role, ["user", "assistant", "system"], "role"),
		kind: readEnum(
			row.kind,
			["message", "clarification", "task", "command", "error"],
			"kind",
		),
		content: readString(row, "content", CHAT_SESSIONS_PATH),
		taskId: readNullableString(row, "taskId", CHAT_SESSIONS_PATH),
		commandAction: readNullableString(row, "commandAction", CHAT_SESSIONS_PATH),
		metadata: readMetadata(row.metadata),
		createdAt: readString(row, "createdAt", CHAT_SESSIONS_PATH),
	};
}

export function parseChatSendResponse(payload: unknown): ChatSendResponse {
	const row = assertObjectRecord(payload, `${CHAT_SESSIONS_PATH}/:id/send`);
	return {
		session: parseChatSessionRecord(row.session),
		messages: parseListResponse(
			row.messages,
			`${CHAT_SESSIONS_PATH}/:id/send:messages`,
			parseChatMessageRecord,
		),
		issue: parseProjectBoardTaskRecord(row.issue),
	};
}

function readQuestionList(value: unknown): TaskClarificationQuestion[] {
	if (!Array.isArray(value)) {
		throw new Error("Invalid chat session field 'pendingQuestions'");
	}
	return value.map(readQuestion);
}

function readQuestion(value: unknown): TaskClarificationQuestion {
	if (typeof value === "string" && value.trim()) {
		return { question: value.trim() };
	}
	const row = assertObjectRecord(value, `${CHAT_SESSIONS_PATH}:question`);
	const options =
		"options" in row ? readQuestionOptions(row.options) : undefined;
	return {
		question: readString(row, "question", CHAT_SESSIONS_PATH),
		...(options?.length ? { options } : {}),
	};
}

function readQuestionOptions(value: unknown): TaskClarificationOption[] {
	if (!Array.isArray(value)) {
		throw new Error("Invalid chat session field 'pendingQuestions.options'");
	}
	return value.map((item) => {
		const row = assertObjectRecord(item, `${CHAT_SESSIONS_PATH}:option`);
		const description =
			"description" in row
				? readString(row, "description", CHAT_SESSIONS_PATH)
				: undefined;
		const recommended =
			"recommended" in row
				? readBoolean(row, "recommended", CHAT_SESSIONS_PATH)
				: undefined;
		return {
			label: readString(row, "label", CHAT_SESSIONS_PATH),
			value: readString(row, "value", CHAT_SESSIONS_PATH),
			...(description ? { description } : {}),
			...(recommended ? { recommended } : {}),
		};
	});
}

function readMetadata(value: unknown): Record<string, unknown> | null {
	if (value === null) {
		return null;
	}
	if (typeof value === "object" && value !== null && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	throw new Error("Invalid chat message field 'metadata'");
}

function readChatSessionWorkflowState(
	row: Record<string, unknown>,
): ChatSessionWorkflowState | null {
	if (!("workflowState" in row) || row.workflowState === null) {
		return null;
	}
	return readEnum(
		row.workflowState,
		CHAT_SESSION_WORKFLOW_STATES,
		"workflowState",
	);
}

function readEnum<T extends string>(
	value: unknown,
	values: readonly T[],
	field: string,
): T {
	if (typeof value === "string" && values.includes(value as T)) {
		return value as T;
	}
	throw new Error(`Invalid chat message field '${field}'`);
}
