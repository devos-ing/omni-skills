"use client";

import type {
	ChatMissionExecution,
	ChatMissionPhase,
	ChatMissionPhaseId,
	ChatMissionPhaseStatus,
	ChatMissionResult,
} from "./types/chat-mission-progress.types";

export const MISSION_PHASES: Array<{ id: ChatMissionPhaseId; label: string }> =
	[
		{ id: "plan", label: "Plan" },
		{ id: "implement", label: "Implement" },
		{ id: "testing", label: "Testing" },
	];

export function createMissionPhases({
	executions,
	latestResult,
	taskStatus,
}: {
	executions: ChatMissionExecution[];
	latestResult: ChatMissionResult | null;
	taskStatus: string;
}): ChatMissionPhase[] {
	const statusByPhase = new Map<ChatMissionPhaseId, ChatMissionPhaseStatus>();
	for (const execution of executions) {
		for (const step of execution.steps) {
			const phase = resolveMissionPhaseForStep(step.action, step.detail);
			if (phase) {
				statusByPhase.set(phase, normalizeMissionPhaseStatus(step.status));
			}
		}
	}
	applyLatestResult(statusByPhase, latestResult);
	return MISSION_PHASES.map((phase) => ({
		...phase,
		status: clampMissionPhaseStatus(phase.id, statusByPhase, taskStatus),
	}));
}

function missionPhaseIndex(phaseId: ChatMissionPhaseId): number {
	return MISSION_PHASES.findIndex((phase) => phase.id === phaseId);
}

function clampMissionPhaseStatus(
	phaseId: ChatMissionPhaseId,
	statusByPhase: Map<ChatMissionPhaseId, ChatMissionPhaseStatus>,
	taskStatus: string,
): ChatMissionPhaseStatus {
	const normalized = taskStatus.toLowerCase();
	const activePhase = activePhaseForTaskStatus(normalized);
	if (activePhase) {
		return clampActivePhaseStatus(phaseId, activePhase, statusByPhase);
	}
	if (normalized === "done") {
		return "success";
	}
	if (normalized === "failed" || normalized === "canceled") {
		return clampTerminalPhaseStatus(phaseId, statusByPhase, normalized);
	}
	return statusByPhase.get(phaseId) ?? "pending";
}

function activePhaseForTaskStatus(
	normalizedTaskStatus: string,
): ChatMissionPhaseId | null {
	if (normalizedTaskStatus === "plan") return "plan";
	if (normalizedTaskStatus === "in_progress") return "implement";
	if (normalizedTaskStatus === "in_review") return "testing";
	return null;
}

function clampActivePhaseStatus(
	phaseId: ChatMissionPhaseId,
	activePhase: ChatMissionPhaseId,
	statusByPhase: Map<ChatMissionPhaseId, ChatMissionPhaseStatus>,
): ChatMissionPhaseStatus {
	const phaseIndex = missionPhaseIndex(phaseId);
	const activeIndex = missionPhaseIndex(activePhase);
	const rawStatus = statusByPhase.get(phaseId);
	if (phaseIndex < activeIndex) return "success";
	if (phaseIndex > activeIndex) return "pending";
	if (rawStatus === "failed" || rawStatus === "warning") {
		return rawStatus;
	}
	if (activePhase === "testing" && rawStatus === "success") return "success";
	return "running";
}

function clampTerminalPhaseStatus(
	phaseId: ChatMissionPhaseId,
	statusByPhase: Map<ChatMissionPhaseId, ChatMissionPhaseStatus>,
	normalizedTaskStatus: "failed" | "canceled",
): ChatMissionPhaseStatus {
	const terminalPhase = latestTerminalPhase(statusByPhase);
	const phaseIndex = missionPhaseIndex(phaseId);
	const terminalIndex = missionPhaseIndex(terminalPhase);
	if (phaseIndex < terminalIndex) return "success";
	if (phaseIndex > terminalIndex) return "pending";
	const rawStatus = statusByPhase.get(phaseId);
	if (rawStatus === "failed" || rawStatus === "warning") return rawStatus;
	return normalizedTaskStatus === "failed" ? "failed" : "warning";
}

function latestTerminalPhase(
	statusByPhase: Map<ChatMissionPhaseId, ChatMissionPhaseStatus>,
): ChatMissionPhaseId {
	for (let index = MISSION_PHASES.length - 1; index >= 0; index -= 1) {
		const phase = MISSION_PHASES[index];
		if (!phase) continue;
		const status = statusByPhase.get(phase.id);
		if (status === "failed" || status === "warning") return phase.id;
	}
	for (let index = MISSION_PHASES.length - 1; index >= 0; index -= 1) {
		const phase = MISSION_PHASES[index];
		if (phase && statusByPhase.has(phase.id)) return phase.id;
	}
	return "testing";
}

function applyLatestResult(
	statusByPhase: Map<ChatMissionPhaseId, ChatMissionPhaseStatus>,
	latestResult: ChatMissionResult | null,
): void {
	if (!latestResult) return;
	const qaStatus = resultToneToPhaseStatus(latestResult.tone);
	statusByPhase.set("qa", qaStatus);
	if (qaStatus === "running" || !statusByPhase.has("testing")) {
		statusByPhase.set("testing", qaStatus === "success" ? "success" : qaStatus);
	}
}

export function resolveMissionPhaseForStep(
	action: string,
	detail: string | null,
): ChatMissionPhaseId | null {
	const event = parseDetail(detail);
	const stage = stringValue(event.stage).toLowerCase();
	const eventAction = stringValue(event.action).toLowerCase();
	const text = `${action} ${stage} ${eventAction}`.toLowerCase();
	if (
		stage === "plan" ||
		text.includes("split-tasks") ||
		text.includes("checkpoint") ||
		text.includes("plan")
	) {
		return "plan";
	}
	if (stage === "in_progress" || text.includes("implement")) {
		return "implement";
	}
	if (stage === "in_review" || text.includes("review-testing")) {
		return "testing";
	}
	return null;
}

export function normalizeMissionPhaseStatus(
	status: string,
): ChatMissionPhaseStatus {
	const normalized = status.toLowerCase();
	if (["started", "queued", "running"].includes(normalized)) return "running";
	if (["succeeded", "success", "completed", "done"].includes(normalized)) {
		return "success";
	}
	if (["failed", "failure", "error", "rejected"].includes(normalized)) {
		return "failed";
	}
	if (["canceled", "cancelled"].includes(normalized)) return "warning";
	return "pending";
}

function resultToneToPhaseStatus(
	tone: ChatMissionResult["tone"],
): ChatMissionPhaseStatus {
	if (tone === "success") return "success";
	if (tone === "error") return "failed";
	if (tone === "warning") return "warning";
	if (tone === "running") return "running";
	return "pending";
}

function parseDetail(detail: string | null): Record<string, unknown> {
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
	return typeof value === "string" ? value : "";
}
