import { describe, expect, it } from "bun:test";
import { summarizeMissionLogLines } from "../src/components/chat-room/chat-mission-log-summary";
import {
	isActiveMissionStatus,
	isMissionVisibleStatus,
} from "../src/components/chat-room/chat-mission-progress-state";
import {
	missionModel,
	missionModelWithSteps,
	progressStep,
	tokenUsageRecord,
} from "./chat-mission-progress-fixtures";

describe("chat mission progress", () => {
	it("groups mission logs into source summaries while preserving raw lines", () => {
		const groups = summarizeMissionLogLines([
			{ id: "line-1", stream: "stdout", text: "User: Review the run" },
			{ id: "line-2", stream: "stdout", text: "Assistant: Checking output" },
			{ id: "line-3", stream: "stdout", text: "Assistant: Summary ready" },
			{ id: "line-4", stream: "stdout", text: "Installing packages" },
			{ id: "line-5", stream: "stderr", text: "Command failed" },
			{ id: "line-6", stream: "system", text: "Stream connected" },
		]);

		expect(
			groups.map((group) => ({
				id: group.id,
				label: group.label,
				lineCount: group.lineCount,
				latestSnippet: group.latestSnippet,
				lines: group.lines.map((line) => line.id),
			})),
		).toEqual([
			{
				id: "user",
				label: "User",
				lineCount: 1,
				latestSnippet: "Review the run",
				lines: ["line-1"],
			},
			{
				id: "assistant",
				label: "Assistant",
				lineCount: 2,
				latestSnippet: "Summary ready",
				lines: ["line-2", "line-3"],
			},
			{
				id: "agent",
				label: "Agent",
				lineCount: 1,
				latestSnippet: "Installing packages",
				lines: ["line-4"],
			},
			{
				id: "error",
				label: "Error",
				lineCount: 1,
				latestSnippet: "Command failed",
				lines: ["line-5"],
			},
			{
				id: "system",
				label: "System",
				lineCount: 1,
				latestSnippet: "Stream connected",
				lines: ["line-6"],
			},
		]);
	});

	it("summarizes structured agent message events as assistant output", () => {
		const groups = summarizeMissionLogLines([
			{
				id: "line-1",
				stream: "stdout",
				text: JSON.stringify({
					type: "item.completed",
					item: {
						type: "agent_message",
						text: "Reviewed the run and found no bugs.",
					},
				}),
			},
		]);

		expect(groups).toEqual([
			expect.objectContaining({
				id: "assistant",
				label: "Assistant",
				latestSnippet: "Reviewed the run and found no bugs.",
				lineCount: 1,
			}),
		]);
	});

	it("tracks active statuses and keeps terminal missions visible", () => {
		expect(isActiveMissionStatus("backlog")).toBe(false);
		expect(isActiveMissionStatus("plan")).toBe(false);
		expect(isActiveMissionStatus("done")).toBe(false);
		expect(isActiveMissionStatus("blocked")).toBe(false);
		expect(isActiveMissionStatus("in_progress")).toBe(true);
		expect(isActiveMissionStatus("in_review")).toBe(true);
		expect(isMissionVisibleStatus("done")).toBe(true);
		expect(isMissionVisibleStatus("failed")).toBe(true);
	});

	it("maps task activity into status, notes, logs, and result", () => {
		const mission = missionModel();

		expect(mission.statusLabel).toBe("Implementing");
		expect(mission.notes[0]?.body).toContain("changed status");
		expect(mission.latestLogLines.at(-1)).toEqual(
			expect.objectContaining({ stream: "stderr", text: "Testing output" }),
		);
		expect(mission.latestResult).toEqual({
			label: "succeeded",
			tone: "success",
		});
		expect(mission.phases.map((phase) => phase.id)).toEqual([
			"plan",
			"implement",
			"testing",
		]);
		expect(mission.phases.map((phase) => phase.label)).toEqual([
			"Planning",
			"Implementing",
			"Testing",
		]);
		expect(mission.phases.map((phase) => phase.status)).toEqual([
			"success",
			"running",
			"pending",
		]);

		expect(mission.phaseLogLines.plan).toEqual([
			expect.objectContaining({ text: "Plan output" }),
		]);
		expect(mission.phaseLogLines.implement).toEqual([
			expect.objectContaining({ text: "Implement output" }),
		]);
		expect(mission.phaseLogLines.testing).toEqual([
			expect.objectContaining({ text: "Testing output" }),
		]);
		expect("phaseCheckpoints" in mission).toBe(false);
	});

	it("keeps workflow progress in phase logs instead of checkpoint progress", () => {
		const mission = missionModelWithSteps({
			taskStatus: "in_progress",
			steps: [
				progressStep(1, "stage:plan", "started", {
					kind: "stage",
					stage: "plan",
					status: "started",
					summary: "Planning issue",
				}),
				progressStep(2, "checkpoint:Inspect current files", "pending", {
					kind: "checkpoint",
					stage: "plan",
					status: "pending",
					title: "Inspect current files and validation details.",
				}),
				progressStep(3, "summary", "recorded", {
					kind: "summary",
					stage: "plan",
					summary: "Plan completed",
					checkpoints: ["Inspect current files and validation details."],
				}),
				progressStep(4, "plan", "succeeded", {
					action: "plan",
					kind: "action",
					stage: "plan",
					status: "succeeded",
				}),
				progressStep(5, "stage:in_progress", "started", {
					kind: "stage",
					stage: "in_progress",
					status: "started",
					summary: "Implementing issue",
				}),
			],
		});

		expect("phaseCheckpoints" in mission).toBe(false);
		expect(mission.phaseLogLines.plan.map((item) => item.text)).toContain(
			"Plan output",
		);
		expect(mission.phaseLogLines.plan.map((item) => item.text)).not.toContain(
			"Inspect current files and validation details.",
		);
	});

	it("summarizes estimated usage on the mission model", () => {
		const mission = missionModel("succeeded", "done", [tokenUsageRecord()]);

		expect(mission.usageSummary).toEqual({
			estimatedCostMicrousd: 20000,
			inputTokens: 1000,
			outputTokens: 250,
			runs: 1,
			totalTokens: 1250,
		});
	});

	it("derives testing status from the latest result without showing a QA phase", () => {
		const mission = missionModel("failed", "failed");

		expect(mission.latestResult).toEqual({
			label: "failed",
			tone: "error",
		});
		expect(mission.phases.find((phase) => phase.id === "qa")).toBeUndefined();
		expect(mission.phases.find((phase) => phase.id === "testing")?.status).toBe(
			"failed",
		);
	});
});
