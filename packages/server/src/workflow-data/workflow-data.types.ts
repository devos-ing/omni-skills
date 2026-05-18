import type {
	PollingEventLevel,
	PollingStatusCounts,
	PollingState,
} from "../db";
import type {
	CreateTaskPayload,
	UpdateTaskPayload,
} from "../http/project-task-api.types";

export const WORKFLOW_DATA_WS_PATH = "/api/workflow";

export type WorkflowDataAction =
	| "tasks.list"
	| "tasks.getByKey"
	| "tasks.createWorkflowTask"
	| "tasks.createIntakeTask"
	| "tasks.update"
	| "tasks.addComment"
	| "tasks.linkPullRequest"
	| "polling.record";

export interface WorkflowPullRequestRecord {
	number?: number;
	url?: string;
	branch: string;
	title: string;
}

export interface WorkflowBoardTaskRecord {
	id: string;
	taskKey: string;
	projectId: string | null;
	title: string;
	content: string;
	priority: number;
	status: string;
	dueDate: string | null;
	creatorId: string;
	assigneeId?: string | null;
	linkedPr: string | null;
	linearIssueId: string | null;
	linearIdentifier: string | null;
	linearUrl: string | null;
	createdAt: string;
	updatedAt: string;
	pullRequest?: WorkflowPullRequestRecord;
}

export interface WorkflowPollingRecordInput {
	pollerId: string;
	sourceType: string;
	sourceId: string;
	projectId?: string | null;
	state: PollingState;
	intervalMs: number;
	counts?: PollingStatusCounts;
	consecutiveFailures?: number;
	lastError?: string | null;
	startedAt?: string | null;
	finishedAt?: string | null;
	successAt?: string | null;
	errorAt?: string | null;
	level: PollingEventLevel;
	eventType: string;
	message: string;
	metadata?: Record<string, unknown>;
}

export interface WorkflowDataRequestFrame {
	type: "workflow.request";
	requestId: string;
	action: WorkflowDataAction;
	payload?: unknown;
}

export type WorkflowDataResponseFrame =
	| {
			type: "workflow.response";
			requestId: string;
			action: WorkflowDataAction;
			status: "ok";
			payload?: unknown;
	  }
	| {
			type: "workflow.response";
			requestId: string;
			action?: WorkflowDataAction;
			status: "error";
			code: string;
			error: string;
	  };

export interface WorkflowDataService {
	handle(
		action: WorkflowDataAction,
		payload: unknown,
	): Promise<unknown | undefined>;
}

export type WorkflowTaskCreatePayload = CreateTaskPayload;
export type WorkflowTaskUpdatePayload = UpdateTaskPayload;
