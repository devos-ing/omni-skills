import type { BoardTaskRow } from "devos-db";
import type { BoardTaskApiRecord } from "../../tasks/types/task-service.types";

export interface TaskChatCreateAnswer {
	question: string;
	answer: string;
}

export interface TaskChatCreateQuestionOption {
	label: string;
	value: string;
	description?: string;
	recommended?: boolean;
}

export interface TaskChatCreateQuestion {
	question: string;
	options?: TaskChatCreateQuestionOption[];
}

export interface TaskChatCreateRequest {
	request: string;
	projectId?: string;
	answers?: TaskChatCreateAnswer[];
}

export type TaskChatCreateIntakeResult =
	| {
			status: "created";
			task: BoardTaskRow;
	  }
	| { status: "needs_info"; questions: TaskChatCreateQuestion[] };

export type TaskChatCreateRequirementResult =
	| {
			status: "ready";
			task: { title: string; description: string };
	  }
	| { status: "needs_info"; questions: TaskChatCreateQuestion[] };

export type TaskChatCreateResponse =
	| {
			status: "created";
			task: BoardTaskApiRecord;
	  }
	| { status: "needs_info"; questions: TaskChatCreateQuestion[] }
	| { status: "db_error"; error: string };
