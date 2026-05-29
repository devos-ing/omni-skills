import type {
	BoardTaskKeyScope,
	BoardTaskRow,
	NewBoardTaskRow,
	NewTaskCommentRow,
} from "devos-db";
import type {
	CreateTaskPayload,
	UpdateTaskPayload,
} from "../../http/types/project-task-api.types";
import type {
	TaskActivityResponse,
	TaskActivitySourceRows,
} from "./task-activity.types";

export type BoardTaskRepositoryRecord = BoardTaskRow & {
	assigneeId: string | null;
};

export interface BoardTaskApiRecord {
	id: string;
	taskKey: string;
	projectId: string | null;
	title: string;
	content: string;
	priority: number;
	status: string;
	dueDate: string | null;
	creatorId: string;
	assigneeId: string | null;
	linkedPr: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface TaskRepository {
	listTasks(): Promise<BoardTaskRepositoryRecord[]>;
	getTask(id: string): Promise<BoardTaskRepositoryRecord | null>;
	getTaskActivity(id: string): Promise<TaskActivitySourceRows | null>;
	projectExists(id: string): Promise<boolean>;
	nextTaskKey(scope: BoardTaskKeyScope): Promise<string>;
	createTask(
		input: NewBoardTaskRow,
		assigneeId?: string | null,
	): Promise<BoardTaskRepositoryRecord>;
	updateTask(
		id: string,
		input: Partial<NewBoardTaskRow>,
		assigneeId?: string | null,
	): Promise<BoardTaskRepositoryRecord | null>;
	deleteTask(id: string): Promise<BoardTaskRepositoryRecord | null>;
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
