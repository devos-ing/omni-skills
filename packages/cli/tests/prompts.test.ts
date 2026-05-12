import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { IssueRef, PullRequestRef } from "../src/features/types";
import {
	buildGithubCommentPrompt,
	buildImplementPrompt,
	buildPlanPrompt,
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

describe("buildImplementPrompt", () => {
	it("tells implementation agents repository freshness was already handled", async () => {
		const prompt = await buildImplementPrompt(
			"/tmp/missing-skill-file.md",
			issue,
			"Update workflow stage transitions.",
		);

		expect(prompt).toContain("do not run git fetch or git pull");
		expect(prompt).toContain("Plan summary:");
	});

	it("includes implementation process guidance from the repo implementation skill", async () => {
		const prompt = await buildImplementPrompt(
			path.resolve(process.cwd(), "skills/piv-implement/SKILL.md"),
			issue,
			"Update workflow stage transitions.",
		);

		expect(prompt).toContain("## Implementation Process");
		expect(prompt).toContain(
			"Re-state scope from the plan before editing code.",
		);
		expect(prompt).toContain("## Validation and Reporting");
		expect(prompt).toContain(
			"List the exact checks/tests run and their outcome.",
		);
	});
});

describe("buildGithubCommentPrompt", () => {
	it("builds a github-comment prompt with review outcome and bugs", async () => {
		const prompt = await buildGithubCommentPrompt(
			"/tmp/missing-skill-file.md",
			issue,
			pr,
			{
				passed: false,
				summary: "Regression found in review.",
				bugs: [{ title: "Bug A", body: "Fix the regression path." }],
			},
		);

		expect(prompt).toContain("You are the github-comment agent");
		expect(prompt).toContain("Review result: FAIL");
		expect(prompt).toContain("Regression found in review.");
		expect(prompt).toContain('"title": "Bug A"');
		expect(prompt).toContain("Return only the final Markdown PR comment body.");
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
			expect(prompt).toContain("SUCCESS_GOAL");
			expect(prompt).toContain("ISSUE_REFINEMENT_JSON");
			expect(prompt).toContain("do not run git fetch or git pull");
			expect(prompt).toContain(
				"When including SPLIT_TASKS_JSON, write action-oriented task titles",
			);
		} finally {
			await rm(tmpDir, { recursive: true, force: true });
		}
	});

	it("includes planning process guidance from the repo plan skill", async () => {
		const prompt = await buildPlanPrompt(
			path.resolve(process.cwd(), "skills/piv-plan/SKILL.md"),
			issue,
		);

		expect(prompt).toContain("## Planning Process");
		expect(prompt).toContain(
			"Keep scope aligned to user intent; do not add unrelated feature work.",
		);
		expect(prompt).toContain("## Scope Guardrails");
		expect(prompt).toContain(
			"Preserve stable contracts used by downstream parsing and routing.",
		);
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
