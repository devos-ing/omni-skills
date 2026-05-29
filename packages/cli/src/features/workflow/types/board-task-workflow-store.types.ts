import type {
	WorkflowBoardTaskRecord,
	WorkflowChatClarificationAnswer,
	WorkflowChatClarificationQuestion,
	WorkflowPullRequestRecord,
} from "../workflow-data-protocol";

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
	externalIssueId: string | null;
	externalIdentifier: string | null;
	externalUrl: string | null;
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
		| "externalIssueId"
		| "externalIdentifier"
		| "externalUrl"
	>
>;

export interface BoardTaskWorkflowStore {
	listTasks(): Promise<BoardTaskWorkflowRecord[]>;
	updateTask(taskId: string, values: BoardTaskUpdateInput): Promise<void>;
	createTask(input: BoardTaskCreateInput): Promise<WorkflowBoardTaskRecord>;
	addComment(taskId: string, body: string): Promise<void>;
	listChatClarificationAnswers(
		taskId: string,
	): Promise<WorkflowChatClarificationAnswer[]>;
	publishChatClarification(
		taskId: string,
		questions: WorkflowChatClarificationQuestion[],
	): Promise<void>;
	linkPullRequest(input: BoardTaskPullRequestLink): Promise<void>;
}
