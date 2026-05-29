export const WORKFLOW_DATA_WS_PATH = "/api/workflow";

export type WorkflowDataAction =
	| "tasks.list"
	| "tasks.getByKey"
	| "tasks.createWorkflowTask"
	| "tasks.createIntakeTask"
	| "tasks.update"
	| "tasks.addComment"
	| "tasks.linkPullRequest"
	| "taskExecutions.start"
	| "taskExecutions.appendStream"
	| "taskExecutions.recordProgress"
	| "taskExecutions.finish"
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
	branchName?: string;
	projectId: string | null;
	title: string;
	content: string;
	priority: number;
	status: string;
	dueDate: string | null;
	creatorId: string;
	assigneeId?: string | null;
	linkedPr: string | null;
	externalIssueId: string | null;
	externalIdentifier: string | null;
	externalUrl: string | null;
	createdAt: string;
	updatedAt: string;
	pullRequest?: WorkflowPullRequestRecord;
}

export interface WorkflowPollingRecordInput {
	pollerId: string;
	sourceType: string;
	sourceId: string;
	projectId?: string | null;
	state: "idle" | "running" | "success" | "error" | "stopped" | "skipped";
	intervalMs: number;
	counts?: {
		issueCount?: number;
		staleRetryCount?: number;
		readyTaskCount?: number;
		dispatchCount?: number;
	};
	consecutiveFailures?: number;
	lastError?: string | null;
	startedAt?: string | null;
	finishedAt?: string | null;
	successAt?: string | null;
	errorAt?: string | null;
	level: "info" | "warn" | "error";
	eventType: string;
	message: string;
	metadata?: Record<string, unknown>;
}

export type WorkflowExecutionStatus = "running" | "succeeded" | "failed";

export interface WorkflowTaskExecutionStartInput {
	executionLogId: string;
	taskId?: string;
	projectId?: string;
	issueKey?: string;
	status?: WorkflowExecutionStatus;
	startedAt?: string;
	log?: string;
}

export interface WorkflowTaskExecutionStreamInput {
	executionLogId: string;
	eventId: string;
	projectId?: string;
	taskId?: string;
	issueKey?: string;
	stage?: string;
	stream: "stdout" | "stderr" | "daemon";
	text: string;
	agentRole?: string;
	agentBackend?: string;
	agentModel?: string;
	phrase?: string;
	emittedAt?: string;
}

export interface WorkflowTaskExecutionProgressInput {
	executionLogId: string;
	eventId: string;
	stepNumber: number;
	event: WorkflowProgressEventRecord;
}

export interface WorkflowTaskExecutionFinishInput {
	executionLogId: string;
	status: Exclude<WorkflowExecutionStatus, "running">;
	finishedAt?: string;
	usage?: WorkflowTaskExecutionUsageInput[];
}

export interface WorkflowTaskExecutionUsageInput {
	id: string;
	runId: string;
	stage: string;
	agentBackend?: string;
	model?: string;
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
	estimatedCostMicrousd?: number;
	recordedAt: string;
}

export interface WorkflowProgressEventRecord {
	schema: "devos.workflow.stream.v1";
	emittedAt: string;
	kind: string;
	[key: string]: unknown;
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
