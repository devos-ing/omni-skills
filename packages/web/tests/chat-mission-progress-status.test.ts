import { describe, expect, it } from "bun:test";

import { resolveMissionStatusLabel } from "../src/components/chat-room/chat-mission-phase-labels";
import type { ChatMissionProgressViewModel } from "../src/components/chat-room/types/chat-mission-progress.types";
import {
	activityStep,
	missionModel,
	missionModelWithSteps,
} from "./chat-mission-progress-fixtures";

describe("chat mission progress status normalization", () => {
	it("maps active task statuses to workflow phase labels", () => {
		expect(resolveMissionStatusLabel({ taskStatus: "plan" })).toBe("Planning");
		expect(resolveMissionStatusLabel({ taskStatus: "planning" })).toBe(
			"Planning",
		);
		expect(resolveMissionStatusLabel({ taskStatus: "in_progress" })).toBe(
			"Implementing",
		);
		expect(resolveMissionStatusLabel({ taskStatus: "in_review" })).toBe(
			"Testing",
		);
		expect(resolveMissionStatusLabel({ taskStatus: "done" })).toBe("Done");
	});

	it("shows loading only for the canonical current stage", () => {
		const mission = missionModelWithRunningSteps("in_progress");

		expect(mission.statusLabel).toBe("Implementing");
		expect(mission.phases.map((phase) => phase.status)).toEqual([
			"success",
			"running",
			"pending",
		]);
		expect(mission.phaseCheckpoints.plan.map((item) => item.status)).toEqual([
			"success",
		]);
		expect(
			mission.phaseCheckpoints.implement.map((item) => item.status),
		).toEqual(["running"]);
		expect(mission.phaseCheckpoints.testing.map((item) => item.status)).toEqual(
			["pending"],
		);
	});

	it("marks upcoming stages pending after advancing to review", () => {
		const mission = missionModelWithRunningSteps("in_review");

		expect(mission.statusLabel).toBe("Testing");
		expect(mission.phases.map((phase) => phase.status)).toEqual([
			"success",
			"success",
			"running",
		]);
		expect(mission.phaseCheckpoints.plan.map((item) => item.status)).toEqual([
			"success",
		]);
		expect(
			mission.phaseCheckpoints.implement.map((item) => item.status),
		).toEqual(["success"]);
		expect(mission.phaseCheckpoints.testing.map((item) => item.status)).toEqual(
			["running"],
		);
	});

	it("marks testing complete when tested while the task remains in review", () => {
		const mission = missionModel("succeeded", "in_review");

		expect(mission.phases.map((phase) => phase.status)).toEqual([
			"success",
			"success",
			"success",
		]);
		expect(mission.phaseCheckpoints.testing.map((item) => item.status)).toEqual(
			["success"],
		);
	});

	it("removes loading states from terminal successful missions", () => {
		const mission = missionModelWithRunningSteps("done");

		expect(mission.statusLabel).toBe("Done");
		expect(mission.phases.map((phase) => phase.status)).toEqual([
			"success",
			"success",
			"success",
		]);
		expect(
			Object.values(mission.phaseCheckpoints)
				.flat()
				.map((checkpoint) => checkpoint.status),
		).not.toContain("running");
	});
});

function missionModelWithRunningSteps(
	taskStatus: string,
): ChatMissionProgressViewModel {
	return missionModelWithSteps({
		executionStatus: "running",
		taskStatus,
		steps: [
			activityStep(1, "plan", "plan", "running"),
			activityStep(2, "implementation", "in_progress", "running"),
			activityStep(3, "review-testing", "in_review", "running"),
		],
	});
}
