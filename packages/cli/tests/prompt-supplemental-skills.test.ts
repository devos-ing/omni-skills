import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { IssueRef } from "../src/features/types";
import { buildPlanPrompt } from "../src/skills/prompts";

const issue: IssueRef = {
	id: "lin_123",
	key: "ENG-1",
	title: "Fix workflow loop",
	description: "Planning should auto-select relevant skills by issue needs.",
	url: "https://linear.app/acme/issue/ENG-1/fix-workflow-loop",
};

async function withPlanSkill<T>(callback: (skillPath: string) => Promise<T>) {
	const tmpDir = await mkdtemp(path.join(os.tmpdir(), "adhd-plan-skill-"));
	const skillPath = path.join(tmpDir, "SKILL.md");
	await writeFile(
		skillPath,
		["name: adhd-plan", "description: base planning skill"].join("\n"),
		"utf8",
	);

	try {
		return await callback(skillPath);
	} finally {
		await rm(tmpDir, { recursive: true, force: true });
	}
}

describe("buildPlanPrompt supplemental skills", () => {
	it("includes Superpowers-style planning discipline without changing parser markers", async () => {
		await withPlanSkill(async (skillPath) => {
			const prompt = await buildPlanPrompt(skillPath, issue);

			expect(prompt).toContain("Superpowers-style planning discipline");
			expect(prompt).toContain("Compare 2-3 viable approaches");
			expect(prompt).toContain("Choose a recommended approach");
			expect(prompt).toContain("Plan test-first implementation");
			expect(prompt).toContain("verification-before-completion");
			expect(prompt).toContain("Keep the parser contract stable");
			expect(prompt).toContain("PLANNING_RESULT: READY");
			expect(prompt).toContain("PLANNING_RESULT: NEEDS_INFO");
		});
	});

	it("includes auto-selected supplemental skills when provided", async () => {
		await withPlanSkill(async (skillPath) => {
			const prompt = await buildPlanPrompt(skillPath, issue, {
				supplementalSkills: [
					{
						name: "linear",
						description: "Use Linear workflows",
						content: "name: linear\ndescription: Linear workflows",
						path: "/tmp/skills/linear/SKILL.md",
						tags: [],
						source: "folder",
						score: 9,
					},
				],
				autoSelectWarnings: ["Database skill source failed: table missing"],
			});

			expect(prompt).toContain("Description: Planning should auto-select");
			expect(prompt).toContain("Auto-selected supplemental skills:");
			expect(prompt).not.toContain("ISSUE_REFINEMENT_JSON");
			expect(prompt).toContain("1. linear");
			expect(prompt).toContain("source: folder");
			expect(prompt).toContain("score: 9");
			expect(prompt).toContain("Auto-selection notes:");
			expect(prompt).toContain("Database skill source failed");
		});
	});

	it("renders multiple standards supplemental skills in plan prompt", async () => {
		await withPlanSkill(async (skillPath) => {
			const prompt = await buildPlanPrompt(skillPath, issue, {
				supplementalSkills: [
					{
						name: "backend-standard",
						description: "Backend service and reliability standards",
						content: "name: backend-standard\ndescription: backend standards",
						path: "/tmp/skills/backend-standard/SKILL.md",
						tags: [],
						source: "folder",
						score: 12,
					},
					{
						name: "typescript-biome-style",
						description: "TypeScript and Biome coding style",
						content:
							"name: typescript-biome-style\ndescription: TypeScript + Biome",
						path: "/tmp/skills/typescript-biome-style/SKILL.md",
						tags: [],
						source: "folder",
						score: 11,
					},
				],
			});

			expect(prompt).toContain("1. backend-standard");
			expect(prompt).toContain("2. typescript-biome-style");
			expect(prompt).toContain("score: 12");
			expect(prompt).toContain("score: 11");
			expect(prompt).toContain("/tmp/skills/backend-standard/SKILL.md");
			expect(prompt).toContain("name: typescript-biome-style");
		});
	});
});
