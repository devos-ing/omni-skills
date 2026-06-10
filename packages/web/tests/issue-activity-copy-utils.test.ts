import { describe, expect, it } from "bun:test";

import { createActivityCopyText } from "../src/components/issues-board/issue-activity-copy-utils";
import type { TaskActivityRecord } from "../src/lib/api";

describe("issue activity copy utilities", () => {
	it("builds compact activity text from body and steps", () => {
		expect(
			createActivityCopyText(
				activity({
					body: "Implemented the change",
					steps: [
						{
							id: "step-1",
							stepNumber: 1,
							action: "run tests",
							status: "success",
							detail: "bun test passed",
							recordedAt: "2026-05-13T00:02:30.000Z",
						},
					],
				}),
			),
		).toBe(
			[
				"devos recorded execution output",
				"Status: success",
				"",
				"Implemented the change",
				"",
				"Steps:",
				"1. run tests [success]",
				"   bun test passed",
			].join("\n"),
		);
	});

	it("copies only readable activity text from structured command output", () => {
		const copyText = createActivityCopyText(
			activity({
				body: JSON.stringify({
					command: "codex exec --prompt secret",
					payload: { prompt: "internal prompt" },
					result: "The task is complete.",
					thinking: "Keep the operator summary concise.",
				}),
				steps: [
					{
						id: "step-1",
						stepNumber: 1,
						action: "implementation",
						status: "success",
						detail: JSON.stringify({
							command: "bun test --filter secret",
							payload: { argv: ["bun", "test"] },
						}),
						recordedAt: "2026-05-13T00:02:30.000Z",
					},
					{
						id: "step-2",
						stepNumber: 2,
						action: "review",
						status: "success",
						detail: JSON.stringify({
							planning: "Follow-up is not needed.",
						}),
						recordedAt: "2026-05-13T00:03:30.000Z",
					},
				],
			}),
		);

		expect(copyText).toBe(
			[
				"devos recorded execution output",
				"Status: success",
				"",
				"Result: The task is complete.",
				"Thinking: Keep the operator summary concise.",
				"",
				"Steps:",
				"1. implementation [success]",
				"2. review [success]",
				"   Planning: Follow-up is not needed.",
			].join("\n"),
		);
		expect(copyText).not.toContain("codex exec");
		expect(copyText).not.toContain("payload");
		expect(copyText).not.toContain("{");
	});
});

function activity(
	overrides: Partial<TaskActivityRecord> = {},
): TaskActivityRecord {
	return {
		id: "activity-1",
		kind: "execution",
		actorId: "devos",
		actorType: "agent",
		title: "recorded execution output",
		body: "",
		status: "success",
		createdAt: "2026-05-13T00:02:00.000Z",
		...overrides,
	};
}
