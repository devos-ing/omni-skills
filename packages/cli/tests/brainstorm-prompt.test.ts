import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildBrainstormPrompt, buildPlanPrompt } from "../src/skills/prompts";

let tempDir: string | undefined;

afterEach(async () => {
	if (tempDir) {
		await rm(tempDir, { recursive: true, force: true });
		tempDir = undefined;
	}
});

describe("brainstorm prompts", () => {
	it("loads the brainstorm skill and feeds brainstorm context to planning", async () => {
		tempDir = await mkdtemp(path.join(os.tmpdir(), "devos-brainstorm-"));
		const brainstormSkill = path.join(tempDir, "brainstorm.md");
		const planSkill = path.join(tempDir, "plan.md");
		await writeFile(brainstormSkill, "Ask focused product questions.", "utf8");
		await writeFile(planSkill, "Plan from context.", "utf8");
		const issue = {
			id: "task-1",
			key: "PIV-1",
			title: "Enhance PIV flow",
			url: "devos://tasks/task-1",
		};

		const brainstormPrompt = await buildBrainstormPrompt(
			brainstormSkill,
			issue,
			{
				answers: [{ question: "Which boundary?", answer: "Workflow phase" }],
			},
		);
		const planPrompt = await buildPlanPrompt(planSkill, issue, {
			brainstormSummary: "Use the workflow phase boundary.",
		});

		expect(brainstormPrompt).toContain("You are the brainstorming agent");
		expect(brainstormPrompt).toContain("Workflow task: PIV-1");
		expect(brainstormPrompt).toContain(
			"Previous brainstorm clarification answers:",
		);
		expect(planPrompt).toContain("Brainstorm context:");
		expect(planPrompt).toContain("Use the workflow phase boundary.");
	});
});
