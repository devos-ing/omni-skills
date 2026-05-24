import type {
	BoardTaskKeyScope,
	BoardTaskRow,
	NewBoardTaskRow,
	NewTaskCommentRow,
} from "devos-db";
import type {
	CreateTaskPayload,
	UpdateTaskPayload,
} from "../http/project-task-api.types";
import type {
	TaskActivityResponse,
	TaskActivitySourceRows,
} from "./task-activity.types";

export type BoardTaskApiRecord = BoardTaskRow & {
	assigneeId: string | null;
};

export interface TaskRepository {
	listTasks(): Promise<BoardTaskApiRecord[]>;
	getTask(id: string): Promise<BoardTaskApiRecord | null>;
	getTaskActivity(id: string): Promise<TaskActivitySourceRows | null>;
	projectExists(id: string): Promise<boolean>;
	nextTaskKey(scope: BoardTaskKeyScope): Promise<string>;
	createTask(
		input: NewBoardTaskRow,
		assigneeId?: string | null,
	): Promise<BoardTaskApiRecord>;
	updateTask(
		id: string,
		input: Partial<NewBoardTaskRow>,
		assigneeId?: string | null,
	): Promise<BoardTaskApiRecord | null>;
	deleteTask(id: string): Promise<BoardTaskApiRecord | null>;
	addTaskComment(input: NewTaskCommentRow): Promise<void>;
}

export type TaskServiceResult<T> =
	| { status: "ok"; value: T }
	| { status: "not_found" }
	| { status: "foreign_key_error" }
	| { status: "invalid_payload" };

export interface TaskService {
	listTasks(): Promise<TaskServiceResult<BoardTaskApiRecord[]>>;
	getTask(id: string): Promise<TaskServiceResult<BoardTaskApiRecord>>;
	getTaskActivity(id: string): Promise<TaskServiceResult<TaskActivityResponse>>;
	createTask(
		input: CreateTaskPayload,
	): Promise<TaskServiceResult<BoardTaskApiRecord>>;
	ensureChatCreatedTask(
		input: { projectId?: string },
		task: BoardTaskRow,
	): Promise<TaskServiceResult<BoardTaskApiRecord>>;
	updateTask(
		id: string,
		input: UpdateTaskPayload,
	): Promise<TaskServiceResult<BoardTaskApiRecord>>;
	deleteTask(id: string): Promise<TaskServiceResult<BoardTaskApiRecord>>;
}
