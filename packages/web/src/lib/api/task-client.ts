import type {
	CreatedTaskRef,
	HealthRequestOptions,
	ProjectBoardTaskRecord,
	TaskCreateRequest,
	TaskCreateResponse,
	TaskMutationRequest,
} from "./client.types";
import {
	assertObjectRecord,
	encodePathSegment,
	readNullableString,
	readNumber,
	readString,
	requestJson,
} from "./response-utils";

const TASKS_PATH = "/api/tasks";
const TASK_CHAT_CREATE_PATH = "/api/tasks/chat-create";

type RequestWithBase = (
	path: string,
	method: "GET" | "POST" | "PATCH" | "DELETE",
	options?: HealthRequestOptions,
	body?: unknown,
) => Promise<unknown>;

function parseCreatedTaskRef(payload: unknown): CreatedTaskRef {
	const row = assertObjectRecord(payload, TASK_CHAT_CREATE_PATH);
	return {
		id: readString(row, "id", TASK_CHAT_CREATE_PATH),
		identifier: readString(row, "identifier", TASK_CHAT_CREATE_PATH),
		title: readString(row, "title", TASK_CHAT_CREATE_PATH),
		url: readString(row, "url", TASK_CHAT_CREATE_PATH),
	};
}

function parseQuestionList(payload: unknown): string[] {
	if (!Array.isArray(payload)) {
		throw new Error(
			"Invalid /api/tasks/chat-create response field 'questions'",
		);
	}
	const questions: string[] = [];
	for (const question of payload) {
		if (typeof question !== "string") {
			throw new Error(
				"Invalid /api/tasks/chat-create response field 'questions'",
			);
		}
		questions.push(question);
	}
	return questions;
}

export function parseTaskCreateResponse(payload: unknown): TaskCreateResponse {
	const row = assertObjectRecord(payload, TASK_CHAT_CREATE_PATH);
	const status = row.status;
	if (status === "created") {
		return {
			status,
			issue: parseCreatedTaskRef(row.issue),
			task: parseProjectBoardTaskRecord(row.task),
		};
	}
	if (status === "needs_info") {
		return { status, questions: parseQuestionList(row.questions) };
	}
	if (status === "linear_error") {
		return { status, error: readString(row, "error", TASK_CHAT_CREATE_PATH) };
	}
	if (status === "db_error") {
		return {
			status,
			error: readString(row, "error", TASK_CHAT_CREATE_PATH),
			issue: parseCreatedTaskRef(row.issue),
		};
	}
	if (status === "link_error") {
		return {
			status,
			error: readString(row, "error", TASK_CHAT_CREATE_PATH),
			issue: parseCreatedTaskRef(row.issue),
			task: parseProjectBoardTaskRecord(row.task),
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
		projectId: readString(row, "projectId", TASKS_PATH),
		title: readString(row, "title", TASKS_PATH),
		content: readString(row, "content", TASKS_PATH),
		priority: readNumber(row, "priority", TASKS_PATH),
		status: readString(row, "status", TASKS_PATH),
		dueDate: readNullableString(row, "dueDate", TASKS_PATH),
		creatorId: readString(row, "creatorId", TASKS_PATH),
		linkedPr: readNullableString(row, "linkedPr", TASKS_PATH),
		createdAt: readString(row, "createdAt", TASKS_PATH),
		updatedAt: readString(row, "updatedAt", TASKS_PATH),
	};
}

export interface TaskApiMethods {
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
