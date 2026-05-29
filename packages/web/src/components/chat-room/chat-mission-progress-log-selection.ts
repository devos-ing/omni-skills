"use client";

import { useState } from "react";

import type {
	ChatMissionLogLine,
	ChatMissionPhase,
	ChatMissionPhaseId,
	ChatMissionProgressViewModel,
} from "./types/chat-mission-progress.types";

interface MissionPhaseSelection {
	selectedPhase: ChatMissionPhase;
	selectedPhaseId: ChatMissionPhaseId;
	selectPhase: (phaseId: ChatMissionPhaseId) => void;
}

export function resolveDefaultSelectedPhaseId(
	phases: ChatMissionPhase[],
): ChatMissionPhaseId {
	const running = phases.find((phase) => phase.status === "running");
	if (running) return running.id;
	const problem = phases.find((phase) =>
		["failed", "warning"].includes(phase.status),
	);
	if (problem) return problem.id;
	for (let index = phases.length - 1; index >= 0; index -= 1) {
		const phase = phases[index];
		if (phase?.status === "success") return phase.id;
	}
	return "plan";
}

export function useMissionPhaseSelection(
	mission: ChatMissionProgressViewModel,
): MissionPhaseSelection {
	const defaultPhaseId = resolveDefaultSelectedPhaseId(mission.phases);
	const [selection, setSelection] = useState<{
		mode: "auto" | "manual";
		phaseId: ChatMissionPhaseId;
		taskId: string;
	}>({ mode: "auto", phaseId: defaultPhaseId, taskId: mission.taskId });
	const phaseExists = mission.phases.some(
		(phase) => phase.id === selection.phaseId,
	);
	const selectedPhaseId =
		selection.taskId === mission.taskId &&
		selection.mode === "manual" &&
		phaseExists
			? selection.phaseId
			: defaultPhaseId;
	const selectedPhase =
		mission.phases.find((phase) => phase.id === selectedPhaseId) ??
		mission.phases[0];
	return {
		selectedPhase,
		selectedPhaseId,
		selectPhase: (phaseId) =>
			setSelection({ mode: "manual", phaseId, taskId: mission.taskId }),
	};
}

export function selectedPhaseLogLines({
	liveLogLines,
	mission,
	selectedPhase,
}: {
	liveLogLines: ChatMissionLogLine[];
	mission: ChatMissionProgressViewModel;
	selectedPhase: ChatMissionPhase;
}): ChatMissionLogLine[] {
	if (selectedPhase.status === "running" && liveLogLines.length > 0) {
		return liveLogLines.slice(-8);
	}
	return mission.phaseLogLines[selectedPhase.id] ?? [];
}
