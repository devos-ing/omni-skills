import {
	assertObjectRecord,
	encodePathSegment,
	parseListResponse,
	readBoolean,
	readNullableString,
	readNumber,
	readString,
} from "./response-utils";
import { parseTaskActivityResponse } from "./task-activity-client";
import type {
	HealthRequestOptions,
	ProjectBoardTaskRecord,
	TaskClarificationOption,
	TaskClarificationQuestion,
	TaskCreateRequest,
	TaskCreateResponse,
	TaskMutationRequest,
} from "./types/client.types";
import type { TaskActivityResponse } from "./types/task-activity.types";

const TASKS_PATH = "/api/tasks";
const TASK_CHAT_CREATE_PATH = "/api/tasks/chat-create";

type RequestWithBase = (
	path: string,
	method: "GET" | "POST" | "PATCH" | "DELETE",
	options?: HealthRequestOptions,
	body?: unknown,
) => Promise<unknown>;

function parseQuestionList(payload: unknown): TaskClarificationQuestion[] {
	if (!Array.isArray(payload)) {
		throw new Error(
			"Invalid /api/tasks/chat-create response field 'questions'",
		);
	}
	return payload.map(parseClarificationQuestion);
}

export function parseTaskCreateResponse(payload: unknown): TaskCreateResponse {
	const row = assertObjectRecord(payload, TASK_CHAT_CREATE_PATH);
	const status = row.status;
	if (status === "created") {
		return {
			status,
			task: parseProjectBoardTaskRecord(row.task),
		};
	}
	if (status === "needs_info") {
		return { status, questions: parseQuestionList(row.questions) };
	}
	if (status === "db_error") {
		return {
			status,
			error: readString(row, "error", TASK_CHAT_CREATE_PATH),
		};
	}
	throw new Error("Invalid /api/tasks/chat-create response field 'status'");
}

export function parseProjectBoardTaskRecord(
	payload: unknown,
): ProjectBoardTaskRecord {
	const row = assertObjectRecord(payload, TASKS_PATH);
	return {
		id: readString(row, "id", TASKS_PATH),
		taskKey: readString(row, "taskKey", TASKS_PATH),
		projectId: readNullableString(row, "projectId", TASKS_PATH),
		title: readString(row, "title", TASKS_PATH),
		content: readTaskContent(row),
		priority: readNumber(row, "priority", TASKS_PATH),
		status: readString(row, "status", TASKS_PATH),
		dueDate: readNullableString(row, "dueDate", TASKS_PATH),
		creatorId: readString(row, "creatorId", TASKS_PATH),
		assigneeId: readOptionalNullableString(row, "assigneeId"),
		linkedPr: readNullableString(row, "linkedPr", TASKS_PATH),
		createdAt: readString(row, "createdAt", TASKS_PATH),
		updatedAt: readString(row, "updatedAt", TASKS_PATH),
	};
}

function readTaskContent(record: Record<string, unknown>): string {
	if (typeof record.content === "string") {
		return record.content;
	}
	if (typeof record.description === "string") {
		return record.description;
	}
	throw new Error(`Invalid ${TASKS_PATH} response field 'content'`);
}

function readOptionalNullableString(
	record: Record<string, unknown>,
	key: string,
): string | null {
	return key in record ? readNullableString(record, key, TASKS_PATH) : null;
}

function parseClarificationQuestion(
	payload: unknown,
): TaskClarificationQuestion {
	if (typeof payload === "string" && payload.trim()) {
		return { question: payload.trim() };
	}
	const row = assertObjectRecord(payload, `${TASK_CHAT_CREATE_PATH}:question`);
	const question = readString(row, "question", TASK_CHAT_CREATE_PATH);
	const options =
		"options" in row ? parseQuestionOptions(row.options) : undefined;
	return { question, ...(options?.length ? { options } : {}) };
}

function parseQuestionOptions(payload: unknown): TaskClarificationOption[] {
	if (!Array.isArray(payload)) {
		throw new Error(
			"Invalid /api/tasks/chat-create response field 'questions.options'",
		);
	}
	return payload.map((item) => {
		const row = assertObjectRecord(item, `${TASK_CHAT_CREATE_PATH}:option`);
		const description =
			"description" in row
				? readString(row, "description", TASK_CHAT_CREATE_PATH)
				: undefined;
		const recommended =
			"recommended" in row
				? readBoolean(row, "recommended", TASK_CHAT_CREATE_PATH)
				: undefined;
		return {
			label: readString(row, "label", TASK_CHAT_CREATE_PATH),
			value: readString(row, "value", TASK_CHAT_CREATE_PATH),
			...(description ? { description } : {}),
			...(recommended ? { recommended } : {}),
		};
	});
}

export interface TaskApiMethods {
	listBoardTasks(
		options?: HealthRequestOptions,
	): Promise<ProjectBoardTaskRecord[]>;
	getBoardTask(
		taskId: string,
		options?: HealthRequestOptions,
	): Promise<ProjectBoardTaskRecord>;
	listTaskActivity(
		taskId: string,
		options?: HealthRequestOptions,
	): Promise<TaskActivityResponse>;
	createTaskFromChat(
		request: TaskCreateRequest,
		options?: HealthRequestOptions,
	): Promise<TaskCreateResponse>;
	createBoardTask(
		request: TaskMutationRequest,
		options?: HealthRequestOptions,
	): Promise<ProjectBoardTaskRecord>;
	updateBoardTask(
		taskId: string,
		request: Partial<TaskMutationRequest>,
		options?: HealthRequestOptions,
	): Promise<ProjectBoardTaskRecord>;
	deleteBoardTask(
		taskId: string,
		options?: HealthRequestOptions,
	): Promise<ProjectBoardTaskRecord>;
}

export function createTaskApiMethods(
	requestWithBase: RequestWithBase,
): TaskApiMethods {
	return {
		async listBoardTasks(options) {
			const payload = await requestWithBase(TASKS_PATH, "GET", options);
			return parseListResponse(
				payload,
				TASKS_PATH,
				parseProjectBoardTaskRecord,
			);
		},
		async getBoardTask(taskId, options) {
			const payload = await requestWithBase(taskPath(taskId), "GET", options);
			return parseProjectBoardTaskRecord(payload);
		},
		async listTaskActivity(taskId, options) {
			const payload = await requestWithBase(
				taskActivityPath(taskId),
				"GET",
				options,
			);
			return parseTaskActivityResponse(payload);
		},
		async createTaskFromChat(request, options) {
			const payload = await requestWithBase(
				TASK_CHAT_CREATE_PATH,
				"POST",
				options,
				request,
			);
			return parseTaskCreateResponse(payload);
		},
		async createBoardTask(request, options) {
			const payload = await requestWithBase(
				TASKS_PATH,
				"POST",
				options,
				request,
			);
			return parseProjectBoardTaskRecord(payload);
		},
		async updateBoardTask(taskId, request, options) {
			const payload = await requestWithBase(
				taskPath(taskId),
				"PATCH",
				options,
				request,
			);
			return parseProjectBoardTaskRecord(payload);
		},
		async deleteBoardTask(taskId, options) {
			const payload = await requestWithBase(
				taskPath(taskId),
				"DELETE",
				options,
			);
			return parseProjectBoardTaskRecord(payload);
		},
	};
}

function taskPath(taskId: string): string {
	return `${TASKS_PATH}/${encodePathSegment(taskId)}`;
}

function taskActivityPath(taskId: string): string {
	return `${taskPath(taskId)}/activity`;
}
