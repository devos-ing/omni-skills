import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildTaskIntakePrompt } from "../src/features/task-intake/prompts";

describe("buildTaskIntakePrompt", () => {
	it("includes plan-readiness guidance, request, and clarification answers", async () => {
		const tmpDir = await mkdtemp(path.join(os.tmpdir(), "adhd-task-skill-"));
		const skillPath = path.join(tmpDir, "SKILL.md");
		await writeFile(skillPath, "Ask precise questions.", "utf8");
		try {
			const prompt = await buildTaskIntakePrompt(skillPath, "Create a task", [
				{ question: "Which app?", answer: "CLI" },
			]);
			expect(prompt).toContain("Ask precise questions.");
			expect(prompt).toContain("no longer has a separate brainstorm stage");
			expect(prompt).toContain("pre-plan clarification gate");
			expect(prompt).toContain("planning agent can process without guessing");
			expect(prompt).toContain("return NEEDS_INFO");
			expect(prompt).toContain("Original request:\nCreate a task");
			expect(prompt).toContain("Q: Which app?");
			expect(prompt).toContain("A: CLI");
			expect(prompt).toContain("RESULT: CLEAR or NEEDS_INFO");
			expect(prompt).toContain("return exactly one concise question");
			expect(prompt).toContain("optional options array");
			expect(prompt).toContain("mark exactly one best option");
			expect(prompt).toContain('"recommended":true');
			expect(prompt).toContain("custom free-form answer");
		} finally {
			await rm(tmpDir, { recursive: true, force: true });
		}
	});
});
