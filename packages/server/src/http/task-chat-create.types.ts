import type { BoardTaskRow } from "devos-db";

export interface TaskChatCreateAnswer {
	question: string;
	answer: string;
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
	| { status: "needs_info"; questions: string[] };

export type TaskChatCreateResponse =
	| {
			status: "created";
			task: BoardTaskRow;
	  }
	| { status: "needs_info"; questions: string[] }
	| { status: "db_error"; error: string };
