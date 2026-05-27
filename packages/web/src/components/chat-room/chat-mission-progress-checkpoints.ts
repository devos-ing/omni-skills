"use client";

import {
	MISSION_PHASES,
	normalizeMissionPhaseStatus,
	resolveMissionPhaseForStep,
} from "./chat-mission-progress-phases";
import type {
	ChatMissionCheckpoint,
	ChatMissionExecution,
	ChatMissionPhase,
	ChatMissionPhaseId,
	ChatMissionPhaseStatus,
} from "./types/chat-mission-progress.types";

export function createEmptyPhaseCheckpoints(): Record<
	ChatMissionPhaseId,
	ChatMissionCheckpoint[]
> {
	return {
		plan: [],
		implement: [],
		testing: [],
		qa: [],
	};
}

export function createPhaseCheckpoints({
	executions,
	phases,
}: {
	executions: ChatMissionExecution[];
	phases: ChatMissionPhase[];
}): Record<ChatMissionPhaseId, ChatMissionCheckpoint[]> {
	const checkpoints = createEmptyPhaseCheckpoints();
	for (const execution of executions) {
		for (const step of execution.steps) {
			if (!isWorkflowProgressStep(step.detail)) continue;
			const phaseId = resolveMissionPhaseForStep(step.action, step.detail);
			if (!phaseId) continue;
			const rawStatus = normalizeMissionPhaseStatus(step.status);
			checkpoints[phaseId].push({
				id: `${execution.id}:${step.id}`,
				detail: step.detail ?? undefined,
				label: formatProgressLabel(step.action, step.detail),
				recordedAt: step.recordedAt,
				status: normalizeCheckpointStatus(phaseId, rawStatus, phases),
			});
		}
	}
	for (const phase of MISSION_PHASES) {
		checkpoints[phase.id].sort(compareCheckpoints);
	}
	return checkpoints;
}

function normalizeCheckpointStatus(
	phaseId: ChatMissionPhaseId,
	rawStatus: ChatMissionPhaseStatus,
	phases: ChatMissionPhase[],
): ChatMissionPhaseStatus {
	const phaseStatus = phases.find((phase) => phase.id === phaseId)?.status;
	if (!phaseStatus) return rawStatus;
	if (phaseStatus === "pending") return "pending";
	if (phaseStatus === "success") return "success";
	if (phaseStatus === "running") return rawStatus;
	if (phaseStatus === "failed" || phaseStatus === "warning") {
		return rawStatus === "failed" || rawStatus === "warning"
			? rawStatus
			: phaseStatus;
	}
	return rawStatus;
}

function compareCheckpoints(
	left: ChatMissionCheckpoint,
	right: ChatMissionCheckpoint,
): number {
	return Date.parse(left.recordedAt) - Date.parse(right.recordedAt);
}

function isWorkflowProgressStep(detail: string | null): boolean {
	const event = parseProgressDetail(detail);
	const kind = stringValue(event.kind);
	return kind === "" || kind === "stage" || kind === "action";
}

function formatProgressLabel(action: string, detail: string | null): string {
	const event = parseProgressDetail(detail);
	const kind = stringValue(event.kind);
	const summary = stringValue(event.summary);
	if (kind === "stage" && summary) return summary;
	const eventAction = stringValue(event.action);
	const agentRole = stringValue(event.agentRole);
	if (eventAction === "agent" && agentRole) {
		return `${formatCheckpointLabel(agentRole)} agent`;
	}
	if (eventAction) return formatCheckpointLabel(eventAction);
	return formatCheckpointLabel(action);
}

function parseProgressDetail(detail: string | null): Record<string, unknown> {
	if (!detail) return {};
	try {
		const parsed = JSON.parse(detail) as unknown;
		return parsed && typeof parsed === "object"
			? (parsed as Record<string, unknown>)
			: {};
	} catch {
		return {};
	}
}

function stringValue(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function formatCheckpointLabel(action: string): string {
	const normalized = action.trim().replace(/[_-]+/g, " ");
	if (!normalized) return "Checkpoint";
	return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
