"use client";

import type {
	ProjectBoardTaskRecord,
	TaskActivityRecord,
	TaskActivityResponse,
	TokenUsageRecord,
} from "@/lib/api";
import { useBoardTaskQuery, useTokenUsageQuery } from "@/lib/api/queries";
import { useTaskActivityQuery } from "@/lib/api/task-activity-query";

import { summarizeTokenUsage } from "../issues-board/issue-task-detail-panel-utils";
import { resolveMissionStatusLabel } from "./chat-mission-phase-labels";
import {
	createEmptyPhaseLogLines,
	createPhaseLogLines,
} from "./chat-mission-progress-logs";
import { createMissionPhases } from "./chat-mission-progress-phases";
import type {
	ChatMissionExecution,
	ChatMissionLogLine,
	ChatMissionProgressViewModel,
	ChatMissionResult,
} from "./types/chat-mission-progress.types";

const ACTIVE_MISSION_STATUSES = new Set(["in_progress", "in_review"]);
const TERMINAL_MISSION_STATUSES = new Set(["done", "failed", "canceled"]);
const MAX_LATEST_LOG_LINES = 8;

export function useChatMissionProgress(
	taskId: string | null,
): ChatMissionProgressViewModel | null {
	const taskQuery = useBoardTaskQuery(taskId ?? "", {
		enabled: Boolean(taskId),
	});
	const shouldLoadActivity =
		Boolean(taskId) &&
		Boolean(taskQuery.data && isMissionVisibleStatus(taskQuery.data.status));
	const activityQuery = useTaskActivityQuery(taskId ?? "", {
		enabled: shouldLoadActivity,
	});
	const usageQuery = useTokenUsageQuery({ enabled: Boolean(taskId) });
	if (!taskId) return null;
	if (taskQuery.error) {
		return createMissionState(taskId, "error", {
			errorMessage: taskQuery.error?.message ?? "Mission progress unavailable.",
		});
	}
	if (taskQuery.isLoading || !taskQuery.data) return null;
	if (!isMissionVisibleStatus(taskQuery.data.status)) return null;
	if (activityQuery.error) {
		return createMissionState(taskId, "error", {
			errorMessage:
				activityQuery.error?.message ?? "Mission progress unavailable.",
		});
	}
	if (activityQuery.isLoading) {
		return createMissionState(taskId, "loading", {
			taskKey: taskQuery.data.taskKey,
			title: taskQuery.data.title,
			status: taskQuery.data.status,
			statusLabel: resolveMissionStatusLabel({
				taskStatus: taskQuery.data.status,
			}),
			updatedAt: taskQuery.data.updatedAt,
		});
	}
	const usageRecords = (usageQuery.data ?? []).filter(
		(record) => record.taskId === taskId,
	);
	return createChatMissionProgressModel({
		activity: activityQuery.data,
		task: taskQuery.data,
		usageRecords,
	});
}

export function isActiveMissionStatus(status: string): boolean {
	return ACTIVE_MISSION_STATUSES.has(status.toLowerCase());
}

export function isMissionVisibleStatus(status: string): boolean {
	const normalized = status.toLowerCase();
	return (
		ACTIVE_MISSION_STATUSES.has(normalized) ||
		TERMINAL_MISSION_STATUSES.has(normalized)
	);
}

export function createChatMissionProgressModel({
	activity,
	task,
	usageRecords = [],
}: {
	activity?: TaskActivityResponse;
	task: ProjectBoardTaskRecord;
	usageRecords?: TokenUsageRecord[];
}): ChatMissionProgressViewModel {
	const activities = activity?.activities ?? [];
	const notes = activities
		.filter((item) => item.kind === "comment" && item.body.trim())
		.map((item) => ({
			id: item.id,
			actorId: item.actorId,
			body: item.body,
			createdAt: item.createdAt,
			title: item.title,
		}));
	const executions = activities
		.filter((item) => item.kind === "execution")
		.map(createMissionExecution);
	const latestResult = createLatestResult(executions);
	const phases = createMissionPhases({
		executions,
		latestResult,
		taskStatus: task.status,
	});
	return {
		state: "ready",
		taskId: task.id,
		taskKey: task.taskKey,
		title: task.title,
		status: task.status,
		statusLabel: resolveMissionStatusLabel({
			phases,
			taskStatus: task.status,
		}),
		updatedAt: task.updatedAt,
		notes,
		executions,
		latestLogLines: createLatestLogLines(executions),
		latestResult,
		usageSummary:
			usageRecords.length > 0 ? summarizeTokenUsage(usageRecords) : null,
		phaseLogLines: createPhaseLogLines({ executions, phases }),
		phases,
	};
}

function createMissionState(
	taskId: string,
	state: "loading" | "error",
	overrides: Partial<ChatMissionProgressViewModel> = {},
): ChatMissionProgressViewModel {
	return {
		state,
		taskId,
		taskKey: "",
		title: "",
		status: "",
		statusLabel: state === "loading" ? "Loading" : "Unavailable",
		updatedAt: "",
		notes: [],
		executions: [],
		latestLogLines: [],
		latestResult: null,
		usageSummary: null,
		phaseLogLines: createEmptyPhaseLogLines(),
		phases: createMissionPhases({
			executions: [],
			latestResult: null,
			taskStatus: "",
		}),
		...overrides,
	};
}

function createMissionExecution(
	activity: TaskActivityRecord,
): ChatMissionExecution {
	return {
		id: activity.id,
		body: activity.body,
		logLines: parseLogLines(activity.id, activity.body),
		startedAt: activity.createdAt,
		status: activity.status,
		steps: activity.steps ?? [],
		title: activity.title,
	};
}

function parseLogLines(
	executionId: string,
	body: string,
): ChatMissionLogLine[] {
	return body
		.split(/\r?\n/)
		.map((line, index) => parseLogLine(executionId, line, index))
		.filter((line) => line.text.trim().length > 0);
}

function parseLogLine(
	executionId: string,
	line: string,
	index: number,
): ChatMissionLogLine {
	const match = line.match(/^\[([^\]\s]+)\s+(stdout|stderr)\]\s?(.*)$/);
	if (!match) {
		return { id: `${executionId}:${index}`, stream: "system", text: line };
	}
	return {
		emittedAt: match[1],
		id: `${executionId}:${index}`,
		stream: match[2] === "stderr" ? "stderr" : "stdout",
		text: match[3] ?? "",
	};
}

function createLatestResult(
	executions: ChatMissionExecution[],
): ChatMissionResult | null {
	const latest = executions.at(-1);
	if (!latest?.status) return null;
	const status = latest.status.toLowerCase();
	if (["success", "succeeded", "done", "completed"].includes(status)) {
		return { label: latest.status, tone: "success" };
	}
	if (["failed", "failure", "error", "rejected"].includes(status)) {
		return { label: latest.status, tone: "error" };
	}
	if (["canceled", "cancelled"].includes(status)) {
		return { label: latest.status, tone: "warning" };
	}
	if (["running", "started", "queued"].includes(status)) {
		return { label: latest.status, tone: "running" };
	}
	return { label: latest.status, tone: "neutral" };
}

function createLatestLogLines(
	executions: ChatMissionExecution[],
): ChatMissionLogLine[] {
	return executions
		.flatMap((execution) => execution.logLines)
		.slice(-MAX_LATEST_LOG_LINES);
}
