import { describe, expect, it } from "bun:test";
import { buildPlannerRepairPrompt } from "../src/features/workflow/plan-repair-prompt";

describe("buildPlannerRepairPrompt", () => {
	it("preserves routing markers and the READY narrative template", () => {
		const prompt = buildPlannerRepairPrompt(
			"original planning prompt",
			"missing routing markers",
		);

		expect(prompt).toContain("original planning prompt");
		expect(prompt).toContain("PLANNING_RESULT: READY");
		expect(prompt).toContain("PLANNING_RESULT: NEEDS_INFO");
		expect(prompt).toContain("ISSUE_REFINEMENT_JSON");
		expect(prompt).toContain(
			"Title, Summary, Key Changes, Checkpoints (Steps), Test plan, Assumptions",
		);
		expect(prompt).toContain("requirement-level progress checkpoints");
		expect(prompt).toContain(
			"implementation target and validation/progress signal",
		);
		expect(prompt).toContain("Do not wrap the full response");
		expect(prompt).toContain("missing routing markers");
	});
});
