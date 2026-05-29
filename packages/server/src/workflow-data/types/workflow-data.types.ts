import type {
	PollingEventLevel,
	PollingState,
	PollingStatusCounts,
} from "devos-db";
import type {
	CreateTaskPayload,
	UpdateTaskPayload,
} from "../../http/types/project-task-api.types";
import type { WorkflowComputerRegistration } from "./workflow-computer.types";

export const WORKFLOW_DATA_WS_PATH = "/api/workflow";

export type WorkflowDataAction =
	| "tasks.list"
	| "tasks.getByKey"
	| "tasks.createWorkflowTask"
	| "tasks.createIntakeTask"
	| "tasks.update"
	| "tasks.addComment"
	| "tasks.linkPullRequest"
	| "chat.publishClarification"
	| "chat.listClarificationAnswers"
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

export interface WorkflowChatClarificationOption {
	label?: string;
	value: string;
	description?: string;
	recommended?: boolean;
}

export interface WorkflowChatClarificationQuestion {
	question: string;
	options?: WorkflowChatClarificationOption[];
}

export interface WorkflowChatClarificationAnswer {
	question: string;
	answer: string;
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

export interface WorkflowDataService {
	handle(
		action: WorkflowDataAction,
		payload: unknown,
	): Promise<unknown | undefined>;
}

export interface WorkflowCliCommandRequest {
	action: string;
	[key: string]: unknown;
}

export interface WorkflowCliCommandInvocation {
	command: string;
	args: string[];
}

export interface WorkflowCliCommandExecutionResult {
	status: "succeeded" | "failed" | "rejected";
	request: WorkflowCliCommandRequest;
	invocation?: WorkflowCliCommandInvocation;
	commandResult?: {
		code: number;
		stdout: string;
		stderr: string;
	};
	error?: string;
}

export type WorkflowCliCommandStreamEvent =
	| {
			type: "start";
			request: WorkflowCliCommandRequest;
			invocation: WorkflowCliCommandInvocation;
	  }
	| { type: "stdout"; text: string }
	| { type: "stderr"; text: string }
	| { type: "progress"; event: unknown }
	| { type: "error"; error: string }
	| { type: "complete"; result: WorkflowCliCommandExecutionResult };

export interface WorkflowPingFrame {
	type: "ping";
	requestId: string;
}

export interface WorkflowPongFrame {
	type: "pong";
	requestId: string;
}

export interface WorkflowClientCommandFrame {
	type: "command";
	requestId: string;
	request: WorkflowCliCommandRequest;
}

export interface WorkflowWorkerReadyFrame {
	type: "cli.worker.ready";
	workerId: string;
	computer?: WorkflowComputerRegistration;
}

export interface WorkflowWorkerDispatchFrame {
	type: "cli.dispatch";
	requestId: string;
	request: WorkflowCliCommandRequest;
}

export type WorkflowCommandStreamFrame = WorkflowCliCommandStreamEvent & {
	requestId: string;
};

export type WorkflowSocketInboundFrame =
	| WorkflowDataRequestFrame
	| WorkflowPingFrame
	| WorkflowClientCommandFrame
	| WorkflowWorkerReadyFrame
	| WorkflowCommandStreamFrame;

export type WorkflowSocketOutboundFrame =
	| WorkflowDataResponseFrame
	| WorkflowPongFrame
	| WorkflowWorkerDispatchFrame
	| WorkflowCommandStreamFrame;

export type WorkflowTaskCreatePayload = CreateTaskPayload;
export type WorkflowTaskUpdatePayload = UpdateTaskPayload;
