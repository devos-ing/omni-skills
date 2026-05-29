import { describe, expect, it } from "bun:test";
import { resolveMissionPlanMessageContent } from "../src/components/chat-room/chat-plan-message-state";
import type { ChatMessageRecord } from "../src/lib/api";
import {
	missionModelWithSteps,
	progressStep,
} from "./chat-mission-progress-fixtures";

const PLAN_TEXT = [
	"PLANNING_RESULT: READY",
	"SUCCESS_GOAL: Show the completed planner output in chat.",
	"COMPLEXITY: SIMPLE",
	"COMPLEXITY_SCORE: 3",
	"Title",
	"Show planner output in chat",
	"Summary",
	"Render the completed plan in the chat transcript.",
	"Agent Plan",
	"- planner: produce the instruction.",
	"- implementer: follow the instruction.",
	"Key Changes",
	"- Add a transcript plan bubble.",
	"Checkpoints (Steps)",
	"- Recover the full plan from execution logs.",
	"Test plan",
	"- Run focused web tests.",
	"Assumptions",
	"- Mission progress is available.",
].join("\n");

describe("chat plan message state", () => {
	it("recovers a completed multiline planner output chunk", () => {
		const mission = missionModelWithPlanBody(PLAN_TEXT);

		expect(resolveMissionPlanMessageContent(mission, [])).toBe(PLAN_TEXT);
	});

	it("recovers parser-compatible planner output without a result marker", () => {
		const planText = [
			"SUCCESS_GOAL: Show the completed planner output in chat.",
			"COMPLEXITY: SIMPLE",
			"COMPLEXITY_SCORE: 3",
			"Ship it.",
		].join("\n");
		const mission = missionModelWithPlanBody(planText);

		expect(resolveMissionPlanMessageContent(mission, [])).toBe(planText);
	});

	it("waits until the planning phase is complete", () => {
		const mission = missionModelWithPlanBody(PLAN_TEXT, "plan", [
			progressStep(1, "stage:plan", "started", {
				kind: "stage",
				stage: "plan",
				status: "started",
				summary: "Planning issue",
			}),
		]);

		expect(resolveMissionPlanMessageContent(mission, [])).toBeNull();
	});

	it("does not duplicate an existing assistant plan message", () => {
		const mission = missionModelWithPlanBody(PLAN_TEXT);
		const messages = [
			{
				content: PLAN_TEXT,
				role: "assistant",
			} as ChatMessageRecord,
		];

		expect(resolveMissionPlanMessageContent(mission, messages)).toBeNull();
	});
});

function missionModelWithPlanBody(
	planText: string,
	taskStatus = "in_progress",
	steps = [
		progressStep(1, "stage:plan", "started", {
			kind: "stage",
			stage: "plan",
			status: "started",
			summary: "Planning issue",
		}),
		progressStep(2, "summary", "recorded", {
			kind: "summary",
			stage: "plan",
			summary: "Plan completed",
		}),
		progressStep(3, "plan", "succeeded", {
			action: "plan",
			kind: "action",
			stage: "plan",
			status: "succeeded",
		}),
	],
) {
	const mission = missionModelWithSteps({ steps, taskStatus });
	const execution = mission.executions[0];
	if (!execution) return mission;
	return {
		...mission,
		executions: [
			{
				...execution,
				body: [
					"[devos-event:event-1]",
					`[2026-05-20T00:02:45.000Z stdout] ${planText}`,
					"[devos-event:event-2]",
					"[2026-05-20T00:04:45.000Z stdout] Implementation output",
				].join("\n"),
			},
		],
	};
}
