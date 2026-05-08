import { describe, expect, it } from "bun:test";
import {
	buildBugsCanceledComment,
	buildImplementationComment,
	buildPlanComment,
	buildReviewComment,
	formatCodexUsageLine,
} from "../src/utils/comments";

describe("buildPlanComment", () => {
	it("includes header and plan summary", () => {
		const comment = buildPlanComment("ENG-1", "1. Do A\n2. Do B", {
			inputTokens: 12,
			outputTokens: 8,
		});
		expect(comment).toContain("ADHD.ai plan for ENG-1");
		expect(comment).toContain("Planning completed; implementation started.");
		expect(comment).toContain("Token usage: input 12, output 8, total 20");
		expect(comment).toContain("1. Do A");
	});

	it("uses fallback when no summary is returned", () => {
		const comment = buildPlanComment("ENG-1", "   ");
		expect(comment).toContain("(No plan summary returned by planning agent.)");
		expect(comment).toContain("Token usage: unknown");
	});
});

describe("formatCodexUsageLine", () => {
	it("formats full usage values", () => {
		expect(
			formatCodexUsageLine({
				inputTokens: 3,
				outputTokens: 7,
				totalTokens: 10,
			}),
		).toBe("Token usage: input 3, output 7, total 10");
	});

	it("derives total when missing", () => {
		expect(
			formatCodexUsageLine({
				inputTokens: 9,
				outputTokens: 4,
			}),
		).toBe("Token usage: input 9, output 4, total 13");
	});

	it("handles missing fields", () => {
		expect(formatCodexUsageLine({ inputTokens: 5 })).toBe(
			"Token usage: input 5, output unknown, total unknown",
		);
		expect(formatCodexUsageLine()).toBe("Token usage: unknown");
	});
});

describe("buildImplementationComment", () => {
	it("includes draft PR URL and usage", () => {
		const comment = buildImplementationComment("https://example.com/pr/1", {
			inputTokens: 2,
			outputTokens: 3,
		});
		expect(comment).toContain("Implementation completed. Draft PR:");
		expect(comment).toContain("https://example.com/pr/1");
		expect(comment).toContain("Token usage: input 2, output 3, total 5");
	});

	it("renders update wording for feedback passes", () => {
		const comment = buildImplementationComment(
			"https://example.com/pr/1",
			undefined,
			{
				updated: true,
			},
		);
		expect(comment).toContain("Implementation updated existing PR branch:");
		expect(comment).toContain("https://example.com/pr/1");
	});

	it("includes fixed bug titles for feedback pass resolution", () => {
		const comment = buildImplementationComment(
			"https://example.com/pr/1",
			{ inputTokens: 2, outputTokens: 3 },
			{
				updated: true,
				fixedBugs: [
					{ title: "Bug A", body: "Details A" },
					{ title: "Bug B", body: "Details B" },
				],
			},
		);
		expect(comment).toContain(
			"Review/testing bugs fixed; returning to review/testing.",
		);
		expect(comment).toContain("Fixed bugs:");
		expect(comment).toContain("- Bug A");
		expect(comment).toContain("- Bug B");
		expect(comment).toContain("Token usage: input 2, output 3, total 5");
	});
});

describe("buildReviewComment", () => {
	it("renders pass review summary", () => {
		const comment = buildReviewComment({
			issueKey: "ENG-1",
			passed: true,
			summary: "Looks good.",
			usage: { inputTokens: 1, outputTokens: 2 },
			bugs: [],
		});
		expect(comment).toContain("ADHD.ai review for ENG-1");
		expect(comment).toContain("Result: PASS");
		expect(comment).toContain("No bugs found.");
	});

	it("renders fail review summary as feedback loop", () => {
		const comment = buildReviewComment({
			issueKey: "ENG-1",
			passed: false,
			summary: "Found regressions.",
			usage: { inputTokens: 1, outputTokens: 2 },
			bugs: [{ title: "Bug A", body: "Details" }],
		});
		expect(comment).toContain("Result: FAIL");
		expect(comment).toContain(
			"Bugs were detected and sent back to implementation.",
		);
	});
});

describe("buildBugsCanceledComment", () => {
	it("includes bug list with issue urls when available", () => {
		const comment = buildBugsCanceledComment([
			{ title: "Bug A", body: "x", issueUrl: "https://example.com/issues/1" },
			{ title: "Bug B", body: "y" },
		]);
		expect(comment).toContain(
			"Review/testing found bugs. Moved issue to Canceled.",
		);
		expect(comment).toContain("- Bug A (https://example.com/issues/1)");
		expect(comment).toContain("- Bug B");
	});
});
