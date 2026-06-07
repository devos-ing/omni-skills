import { createChatMissionProgressModel } from "../src/components/chat-room/chat-mission-progress-state";
import type { ChatMissionProgressViewModel } from "../src/components/chat-room/types/chat-mission-progress.types";
import type {
	ProjectBoardTaskRecord,
	TaskActivityRecord,
	TaskActivityStepRecord,
	TokenUsageRecord,
} from "../src/lib/api";

export function missionModel(
	status = "succeeded",
	taskStatus = "in_progress",
	usageRecords: TokenUsageRecord[] = [],
): ChatMissionProgressViewModel {
	return missionModelWithSteps({
		executionStatus: status,
		taskStatus,
		usageRecords,
	});
}

export function missionModelWithSteps({
	executionStatus = "succeeded",
	linkedPr = null,
	steps = defaultActivitySteps(),
	taskStatus = "in_progress",
	usageRecords = [],
}: {
	executionStatus?: string;
	linkedPr?: string | null;
	steps?: TaskActivityStepRecord[];
	taskStatus?: string;
	usageRecords?: TokenUsageRecord[];
}): ChatMissionProgressViewModel {
	return createChatMissionProgressModel({
		task: boardTask(taskStatus, linkedPr),
		activity: {
			taskId: "task-42",
			activities: [statusComment(), executionActivity(executionStatus, steps)],
		},
		usageRecords,
	});
}

export function tokenUsageRecord(
	overrides: Partial<TokenUsageRecord> = {},
): TokenUsageRecord {
	return {
		id: "usage-1",
		runId: "run-1",
		taskId: "task-42",
		taskExecutionLogId: "exec-1",
		stage: "implementing",
		agentBackend: "codex",
		model: "gpt-5",
		inputTokens: 1000,
		outputTokens: 250,
		totalTokens: 1250,
		estimatedCostMicrousd: 20000,
		recordedAt: "2026-05-20T00:05:00.000Z",
		...overrides,
	};
}

function statusComment(): TaskActivityRecord {
	return {
		id: "comment-1",
		kind: "comment",
		actorId: "system",
		actorType: "system",
		title: "updated this issue",
		body: "changed status from `plan` to `in_progress`",
		status: null,
		createdAt: "2026-05-20T00:01:00.000Z",
	};
}

function executionActivity(
	status: string,
	steps: TaskActivityStepRecord[],
): TaskActivityRecord {
	return {
		id: "exec-1",
		kind: "execution",
		actorId: "devos",
		actorType: "agent",
		title: "recorded execution output",
		body: [
			"[2026-05-20T00:02:45.000Z stdout] Plan output",
			"[2026-05-20T00:04:45.000Z stdout] Implement output",
			"[2026-05-20T00:06:45.000Z stderr] Testing output",
		].join("\n"),
		status,
		createdAt: "2026-05-20T00:02:00.000Z",
		steps,
	};
}

export function activityStep(
	stepNumber: number,
	action: string,
	stage: string,
	status = "succeeded",
): TaskActivityStepRecord {
	return {
		id: `step-${stepNumber}`,
		stepNumber,
		action,
		status,
		detail: JSON.stringify({ stage, action }),
		recordedAt: `2026-05-20T00:0${stepNumber + 1}:30.000Z`,
	};
}

export function progressStep(
	stepNumber: number,
	action: string,
	status: string,
	detail: Record<string, unknown>,
): TaskActivityStepRecord {
	return {
		id: `progress-${stepNumber}`,
		stepNumber,
		action,
		status,
		detail: JSON.stringify(detail),
		recordedAt: `2026-05-20T00:${String(stepNumber + 1).padStart(2, "0")}:30.000Z`,
	};
}

function defaultActivitySteps(): TaskActivityStepRecord[] {
	return [
		activityStep(1, "plan", "plan"),
		activityStep(2, "split-tasks", "plan"),
		activityStep(3, "implementation", "in_progress"),
		activityStep(4, "prepare-pr", "in_progress"),
		activityStep(5, "review-testing", "in_review"),
	];
}

function boardTask(
	status = "in_progress",
	linkedPr: string | null = null,
): ProjectBoardTaskRecord {
	return {
		id: "task-42",
		taskKey: "TASK-42",
		projectId: "project-1",
		title: "Show mission progress",
		content: "Display progress in the chat transcript.",
		priority: 2,
		status,
		dueDate: null,
		creatorId: "owner-1",
		assigneeId: null,
		linkedPr,
		createdAt: "2026-05-20T00:00:00.000Z",
		updatedAt: "2026-05-20T00:03:00.000Z",
	};
}
