import type {
	WorkflowBoardTaskRecord,
	WorkflowPullRequestRecord,
} from "devos-server/workflow-data";

export interface BoardTaskWorkflowRecord {
	task: WorkflowBoardTaskRecord;
	pullRequest?: WorkflowPullRequestRecord;
}

export interface BoardTaskPullRequestLink {
	taskId: string;
	repository: string;
	pullRequest: WorkflowPullRequestRecord;
}

export interface BoardTaskCreateInput {
	projectId: string | null;
	title: string;
	content: string;
	priority: number;
	status: string;
	dueDate: string | null;
	creatorId: string;
	linkedPr: string | null;
	linearIssueId: string | null;
	linearIdentifier: string | null;
	linearUrl: string | null;
}

export type BoardTaskUpdateInput = Partial<
	Pick<
		WorkflowBoardTaskRecord,
		| "taskKey"
		| "projectId"
		| "title"
		| "content"
		| "priority"
		| "status"
		| "creatorId"
		| "dueDate"
		| "linkedPr"
		| "linearIssueId"
		| "linearIdentifier"
		| "linearUrl"
	>
>;

export interface BoardTaskWorkflowStore {
	listTasks(): Promise<BoardTaskWorkflowRecord[]>;
	updateTask(taskId: string, values: BoardTaskUpdateInput): Promise<void>;
	createTask(input: BoardTaskCreateInput): Promise<WorkflowBoardTaskRecord>;
	addComment(taskId: string, body: string): Promise<void>;
	linkPullRequest(input: BoardTaskPullRequestLink): Promise<void>;
}
