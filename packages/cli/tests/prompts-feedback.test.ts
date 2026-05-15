import { describe, expect, it } from "bun:test";
import path from "node:path";
import type { IssueRef, PullRequestRef } from "../src/features/types";
import { buildFixPrompt, buildReviewPrompt } from "../src/skills/prompts";

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
	it("includes review feedback and a repair protocol for retry implementation", async () => {
		const prompt = await buildFixPrompt(
			"/tmp/missing-skill-file.md",
			issue,
			"Update workflow stage transitions.",
			"Regression found in verify stage.",
			[
				{
					title: "Bug A",
					body: [
						"Failing command/repro: bun test workflow.test.ts",
						"Observed: retry skips run-state save.",
						"Expected: retry persists the next stage.",
						"Likely files/code path: workflow retry handler.",
						"Fix expectation: save state before resuming.",
						"Verification: bun test packages/cli/tests/workflow.test.ts",
					].join("\n"),
				},
			],
			pr,
		);

		expect(prompt).toContain(
			"This is a fix pass after review/testing found bugs.",
		);
		expect(prompt).toContain("Linear issue: ENG-1");
		expect(prompt).toContain("do not run git fetch or git pull");
		expect(prompt).toContain("PR: https://github.com/acme/repo/pull/10");
		expect(prompt).toContain("Regression found in verify stage.");
		expect(prompt).toContain('"title": "Bug A"');
		expect(prompt).toContain("Fix-pass instructions:");
		expect(prompt).toContain("Address every bug in BUGS_JSON");
		expect(prompt).toContain("Break the repair work into checkpointed fixes");
		expect(prompt).toContain(
			"report each bug-fix checkpoint as completed or blocked",
		);
		expect(prompt).toContain("Preserve unrelated user changes");
		expect(prompt).toContain("Add or update regression tests");
		expect(prompt).toContain("Run each listed verification command/check");
		expect(prompt).toContain("completed and blocked checkpoints");
		expect(prompt).toContain("remaining risk");
	});
});

describe("buildReviewPrompt", () => {
	it("requires bun test and structured bug bodies for failed reviews", async () => {
		const prompt = await buildReviewPrompt(
			"/tmp/missing-skill-file.md",
			issue,
			pr,
			{
				planSummary: "Plan the retry cap.",
				successGoal: "Review/testing stops after three fix passes.",
			},
		);

		expect(prompt).toContain("run `bun test`");
		expect(prompt).toContain("Success goal:");
		expect(prompt).toContain("Review/testing stops after three fix passes.");
		expect(prompt).toContain("acceptance boundary");
		expect(prompt).toContain("do not run git fetch or git pull");
		expect(prompt).toContain("If `bun test` cannot be run");
		expect(prompt).toContain("RESULT: FAIL");
		expect(prompt).toContain("structured repair checklist");
		expect(prompt).toContain("failing command or reproduction step");
		expect(prompt).toContain("observed behavior");
		expect(prompt).toContain("expected behavior");
		expect(prompt).toContain("likely files or code path");
		expect(prompt).toContain("verification command/check");
	});

	it("falls back to plan summary when success goal is absent", async () => {
		const prompt = await buildReviewPrompt(
			"/tmp/missing-skill-file.md",
			issue,
			pr,
			{ planSummary: "Plan summary as scope." },
		);

		expect(prompt).toContain("Success scope fallback from plan summary:");
		expect(prompt).toContain("Plan summary as scope.");
	});

	it("includes review guidelines from the repo review skill", async () => {
		const prompt = await buildReviewPrompt(
			path.resolve(process.cwd(), "skills/piv-review-test/SKILL.md"),
			issue,
			pr,
		);

		expect(prompt).toContain("## Review Process");
		expect(prompt).toContain("## Review Guidelines");
		expect(prompt).toContain("Do not fail solely for style");
		expect(prompt).toContain("When reporting `RESULT: PASS`");
		expect(prompt).toContain("## Failed Bug Detail Checklist");
		expect(prompt).toContain("## Checkpoints");
		expect(prompt).toContain("Review scope checkpoint");
		expect(prompt).toContain("Coverage checkpoint");
		expect(prompt).toContain("Testing checkpoint");
		expect(prompt).toContain("Output checkpoint");
	});
});
