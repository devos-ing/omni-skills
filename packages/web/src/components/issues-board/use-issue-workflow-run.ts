"use client";

import type {
	CliCommandStreamEvent,
	ProjectBoardTaskRecord,
	WorkflowProgressEvent,
} from "@/lib/api";
import { buildIssueRunCommand, createWebApiClient } from "@/lib/api";
import { useState } from "react";

type IssueWorkflowRunStatus =
	| "idle"
	| "running"
	| "succeeded"
	| "failed"
	| "rejected";

export interface IssueWorkflowRunLogLine {
	id: string;
	stream: "stdout" | "stderr" | "system" | "progress";
	text: string;
}

export interface IssueWorkflowRunState {
	status: IssueWorkflowRunStatus;
	task?: {
		taskKey: string;
		title: string;
		projectId: string | null;
	};
	logs: IssueWorkflowRunLogLine[];
	error?: string;
}

export interface IssueWorkflowRunController {
	state: IssueWorkflowRunState;
	clearRunState: () => void;
	runIssue: (task: ProjectBoardTaskRecord) => Promise<void>;
}

const apiClient = createWebApiClient();
const EMPTY_RUN_STATE: IssueWorkflowRunState = { status: "idle", logs: [] };
const MAX_LOG_LINES = 120;

export function useIssueWorkflowRun(): IssueWorkflowRunController {
	const [runState, setRunState] =
		useState<IssueWorkflowRunState>(EMPTY_RUN_STATE);

	async function runIssue(task: ProjectBoardTaskRecord): Promise<void> {
		if (runState.status === "running") {
			setRunState((current) =>
				appendLog(current, "system", "A workflow run is already active."),
			);
			return;
		}
		const taskSummary = {
			taskKey: task.taskKey,
			title: task.title,
			projectId: task.projectId,
		};
		if (!task.projectId) {
			setRunState({
				status: "failed",
				task: taskSummary,
				error: "Issue must belong to a project before workflow can run.",
				logs: [
					createLogLine(
						"system",
						"Issue must belong to a project before workflow can run.",
					),
				],
			});
			return;
		}
		setRunState({
			status: "running",
			task: taskSummary,
			logs: [createLogLine("system", `Queued workflow for ${task.taskKey}.`)],
		});
		try {
			await apiClient.streamCliCommand(
				buildIssueRunCommand({
					projectId: task.projectId,
					issueKey: task.taskKey,
				}),
				(event) => setRunState((current) => applyStreamEvent(current, event)),
			);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Workflow stream failed.";
			setRunState((current) => ({
				...appendLog(current, "system", message),
				status: "failed",
				error: message,
			}));
		}
	}

	function clearRunState(): void {
		setRunState((current) =>
			current.status === "running" ? current : EMPTY_RUN_STATE,
		);
	}

	return { state: runState, clearRunState, runIssue };
}

function applyStreamEvent(
	state: IssueWorkflowRunState,
	event: CliCommandStreamEvent,
): IssueWorkflowRunState {
	if (event.type === "start") {
		return appendLog(state, "system", "Workflow started.");
	}
	if (event.type === "stdout" || event.type === "stderr") {
		return appendLog(state, event.type, event.text);
	}
	if (event.type === "progress") {
		return appendLog(state, "progress", formatProgressEvent(event.event));
	}
	if (event.type === "error") {
		return {
			...appendLog(state, "system", event.error),
			status: "failed",
			error: event.error,
		};
	}
	const status = event.result.status;
	return {
		...appendLog(state, "system", `Workflow ${status}.`),
		status,
		error: event.result.error,
	};
}

function formatProgressEvent(event: WorkflowProgressEvent): string {
	const summary = [event.stage, event.action, event.status]
		.filter(isNonEmptyString)
		.join(" ");
	const detail = event.message ?? event.detail ?? event.error;
	if (summary && detail) {
		return `${summary}: ${detail}`;
	}
	return summary || detail || event.kind || "Workflow progress updated.";
}

function appendLog(
	state: IssueWorkflowRunState,
	stream: IssueWorkflowRunLogLine["stream"],
	text: string,
): IssueWorkflowRunState {
	const trimmed = text.trimEnd();
	if (!trimmed) {
		return state;
	}
	return {
		...state,
		logs: [...state.logs, createLogLine(stream, trimmed)].slice(-MAX_LOG_LINES),
	};
}

function createLogLine(
	stream: IssueWorkflowRunLogLine["stream"],
	text: string,
): IssueWorkflowRunLogLine {
	return {
		id: crypto.randomUUID(),
		stream,
		text,
	};
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}
