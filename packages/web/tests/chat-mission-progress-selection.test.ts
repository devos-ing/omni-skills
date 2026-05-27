import { describe, expect, it } from "bun:test";

import {
	selectedPhaseCheckpoints,
	selectedPhaseLogLines,
} from "../src/components/chat-room/chat-mission-progress-log-selection";
import type {
	ChatMissionPhaseId,
	ChatMissionProgressViewModel,
} from "../src/components/chat-room/types/chat-mission-progress.types";
import type { ChatStreamLine } from "../src/components/chat-room/types/chat-room.types";
import { missionModel } from "./chat-mission-progress-fixtures";

describe("chat mission progress selection", () => {
	it("selects stored output and checkpoints for each clicked phase", () => {
		const mission = missionModel("succeeded", "done");
		const liveLogLines: ChatStreamLine[] = [
			{ id: "live-1", stream: "stdout", text: "Live output" },
		];

		expect(selectedLogText(mission, "plan", liveLogLines)).toEqual([
			"Plan output",
		]);
		expect(selectedCheckpointLabels(mission, "plan")).toEqual([
			"Plan",
			"Split tasks",
		]);
		expect(selectedLogText(mission, "implement", liveLogLines)).toEqual([
			"Implement output",
		]);
		expect(selectedCheckpointLabels(mission, "implement")).toEqual([
			"Implementation",
			"Prepare pr",
		]);
		expect(selectedLogText(mission, "testing", liveLogLines)).toEqual([
			"Testing output",
		]);
		expect(selectedCheckpointLabels(mission, "testing")).toEqual([
			"Review testing",
		]);
		expect(mission.phases.map((phase) => phase.id)).not.toContain("qa");
	});

	it("keeps live output scoped to the running selected phase", () => {
		const mission = missionModel("running", "in_review");
		const liveLogLines: ChatStreamLine[] = [
			{ id: "live-1", stream: "stdout", text: "Live output" },
		];

		expect(selectedLogText(mission, "testing", liveLogLines)).toEqual([
			"Live output",
		]);
		expect(selectedLogText(mission, "plan", liveLogLines)).toEqual([
			"Plan output",
		]);
	});
});

function selectedLogText(
	mission: ChatMissionProgressViewModel,
	phaseId: ChatMissionPhaseId,
	liveLogLines: ChatStreamLine[],
): string[] {
	return selectedPhaseLogLines({
		liveLogLines,
		mission,
		selectedPhase: phaseById(mission, phaseId),
	}).map((line) => line.text);
}

function selectedCheckpointLabels(
	mission: ChatMissionProgressViewModel,
	phaseId: ChatMissionPhaseId,
): string[] {
	return selectedPhaseCheckpoints({
		mission,
		selectedPhase: phaseById(mission, phaseId),
	}).map((checkpoint) => checkpoint.label);
}

function phaseById(
	mission: ChatMissionProgressViewModel,
	phaseId: ChatMissionPhaseId,
): ChatMissionProgressViewModel["phases"][number] {
	const phase = mission.phases.find((item) => item.id === phaseId);
	if (!phase) throw new Error(`Missing phase ${phaseId}`);
	return phase;
}
