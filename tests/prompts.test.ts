import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { IssueRef, PullRequestRef } from "../src/core/types";
import {
	buildFixPrompt,
	buildPlanPrompt,
	buildReviewPrompt,
} from "../src/skills/prompts";

const issue: IssueRef = {
	id: "lin_123",
	key: "ENG-1",
	title: "Fix workflow loop",
	description: "Planning should auto-select relevant skills by issue needs.",
	url: "https://linear.app/acme/issue/ENG-1/fix-workflow-loop",
};

const pr: PullRequestRef = {
	branch: "codex/eng-1",
	title: "[codex] ENG-1: Fix workflow loop",
	url: "https://github.com/acme/repo/pull/10",
};

describe("buildFixPrompt", () => {
	it("includes review feedback and bug JSON for retry implementation", async () => {
		const prompt = await buildFixPrompt(
			"/tmp/missing-skill-file.md",
			issue,
			"Update workflow stage transitions.",
			"Regression found in verify stage.",
			[{ title: "Bug A", body: "Implement retry behavior." }],
			pr,
		);

		expect(prompt).toContain(
			"This is a fix pass after review/testing found bugs.",
		);
		expect(prompt).toContain("Linear issue: ENG-1");
		expect(prompt).toContain("PR: https://github.com/acme/repo/pull/10");
		expect(prompt).toContain("Regression found in verify stage.");
		expect(prompt).toContain('"title": "Bug A"');
		expect(prompt).toContain(
			"Address every bug, update the existing branch/PR",
		);
	});
});

describe("buildReviewPrompt", () => {
	it("requires bun test for review/testing validation", async () => {
		const prompt = await buildReviewPrompt(
			"/tmp/missing-skill-file.md",
			issue,
			pr,
		);

		expect(prompt).toContain("run `bun test`");
		expect(prompt).toContain("If `bun test` cannot be run");
		expect(prompt).toContain("RESULT: FAIL");
	});

	it("includes review guidelines from the repo review skill", async () => {
		const prompt = await buildReviewPrompt(
			path.resolve(process.cwd(), "skills/piv-review-test/SKILL.md"),
			issue,
			pr,
		);

		expect(prompt).toContain("## Review Guidelines");
		expect(prompt).toContain("Do not fail solely for style");
		expect(prompt).toContain("When reporting `RESULT: PASS`");
	});
});

describe("buildPlanPrompt", () => {
	it("includes planning decomposition contract from skill text", async () => {
		const tmpDir = await mkdtemp(path.join(os.tmpdir(), "adhd-plan-skill-"));
		const skillPath = path.join(tmpDir, "SKILL.md");
		await writeFile(
			skillPath,
			[
				"name: adhd-plan",
				"COMPLEXITY: SIMPLE|COMPLEX",
				"COMPLEXITY_SCORE: 0..10",
				"SPLIT_TASKS_JSON: [...]",
			].join("\n"),
			"utf8",
		);
		try {
			const prompt = await buildPlanPrompt(skillPath, issue);
			expect(prompt).toContain("COMPLEXITY: SIMPLE|COMPLEX");
			expect(prompt).toContain("COMPLEXITY_SCORE: 0..10");
			expect(prompt).toContain("SPLIT_TASKS_JSON: [...]");
			expect(prompt).toContain("ISSUE_REFINEMENT_JSON");
			expect(prompt).toContain(
				"When including SPLIT_TASKS_JSON, write action-oriented task titles",
			);
		} finally {
			await rm(tmpDir, { recursive: true, force: true });
		}
	});

	it("includes auto-selected supplemental skills when provided", async () => {
		const tmpDir = await mkdtemp(path.join(os.tmpdir(), "adhd-plan-skill-"));
		const skillPath = path.join(tmpDir, "SKILL.md");
		await writeFile(
			skillPath,
			["name: adhd-plan", "description: base planning skill"].join("\n"),
			"utf8",
		);

		try {
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
			expect(prompt).toContain("Include ISSUE_REFINEMENT_JSON");
			expect(prompt).toContain("1. linear");
			expect(prompt).toContain("source: folder");
			expect(prompt).toContain("score: 9");
			expect(prompt).toContain("Auto-selection notes:");
			expect(prompt).toContain("Database skill source failed");
		} finally {
			await rm(tmpDir, { recursive: true, force: true });
		}
	});

	it("renders multiple standards supplemental skills in plan prompt", async () => {
		const tmpDir = await mkdtemp(path.join(os.tmpdir(), "adhd-plan-skill-"));
		const skillPath = path.join(tmpDir, "SKILL.md");
		await writeFile(
			skillPath,
			["name: adhd-plan", "description: base planning skill"].join("\n"),
			"utf8",
		);

		try {
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
		} finally {
			await rm(tmpDir, { recursive: true, force: true });
		}
	});
});
