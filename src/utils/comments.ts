import type { BugRecord, SplitTaskRef } from "../core/types";

export interface TokenUsage {
	inputTokens?: number;
	outputTokens?: number;
	totalTokens?: number;
}

export function formatCodexUsageLine(usage?: TokenUsage): string {
	if (!usage) {
		return "Token usage 🧮: unknown";
	}
	const input = usage.inputTokens ?? "unknown";
	const output = usage.outputTokens ?? "unknown";
	const total =
		usage.totalTokens ??
		(typeof usage.inputTokens === "number" &&
		typeof usage.outputTokens === "number"
			? usage.inputTokens + usage.outputTokens
			: "unknown");
	return `Token usage 🧮: input ${input}, output ${output}, total ${total}`;
}

export function buildPlanComment(
	issueKey: string,
	planSummary: string,
	usage?: TokenUsage,
): string {
	const maxSummaryLength = 6000;
	const normalized = planSummary.trim();
	const truncated =
		normalized.length > maxSummaryLength
			? `${normalized.slice(0, maxSummaryLength)}\n\n[truncated]`
			: normalized;

	return [
		`ADHD.ai plan for ${issueKey}`,
		"",
		"Planning completed; implementation started.",
		"",
		formatCodexUsageLine(usage),
		"",
		"Plan:",
		truncated || "(No plan summary returned by planning agent.)",
	].join("\n");
}

export function buildPlanSplitComment(
	issueKey: string,
	planSummary: string,
	splitTasks: SplitTaskRef[],
	options?: { usage?: TokenUsage },
): string {
	const maxSummaryLength = 6000;
	const normalized = planSummary.trim();
	const truncated =
		normalized.length > maxSummaryLength
			? `${normalized.slice(0, maxSummaryLength)}\n\n[truncated]`
			: normalized;
	const taskLines =
		splitTasks.length > 0
			? splitTasks.map(
					(task) =>
						`- ${task.title}${task.issueKey ? ` (${task.issueKey})` : ""}${task.issueUrl ? `: ${task.issueUrl}` : ""}`,
				)
			: ["- (No split tasks were created.)"];

	return [
		`ADHD.ai plan for ${issueKey}`,
		"",
		"Planning marked this task as too complex for a single implementation pass.",
		"Created split tasks in Todo and moved the parent issue to Backlog.",
		"",
		formatCodexUsageLine(options?.usage),
		"",
		"Created tasks:",
		...taskLines,
		"",
		"Plan:",
		truncated || "(No plan summary returned by planning agent.)",
	].join("\n");
}

export function buildImplementationComment(
	draftPrUrl: string | undefined,
	usage?: TokenUsage,
	options?: { updated?: boolean; fixedBugs?: BugRecord[] },
): string {
	const statusLine = options?.updated
		? `Implementation updated existing PR branch: ${draftPrUrl ?? "(updated)"}`
		: `Implementation completed. Draft PR: ${draftPrUrl ?? "(created)"}`;
	const fixedBugLines =
		options?.updated && options.fixedBugs && options.fixedBugs.length > 0
			? [
					"Review/testing bugs fixed; returning to review/testing.",
					"Fixed bugs:",
					...options.fixedBugs.map((bug) => `- ${bug.title}`),
				]
			: [];
	return [statusLine, ...fixedBugLines, formatCodexUsageLine(usage)].join("\n");
}

export function buildReviewComment(input: {
	issueKey: string;
	passed: boolean;
	summary: string;
	usage?: TokenUsage;
	bugs: BugRecord[];
}): string {
	return [
		`ADHD.ai review for ${input.issueKey}`,
		"",
		`Result: ${input.passed ? "PASS ✅" : "FAIL ❌"}`,
		"",
		formatCodexUsageLine(input.usage),
		"",
		input.summary,
		"",
		input.bugs.length > 0
			? "Bugs were detected and sent back to implementation."
			: input.passed
				? "No bugs found. ✅"
				: "Review failed without structured bug details; feedback was still sent to implementation.",
	].join("\n");
}

export function buildBugsCanceledComment(bugs: BugRecord[]): string {
	return [
		"Review/testing found bugs. Moved issue to Canceled.",
		...bugs.map(
			(bug) => `- ${bug.title}${bug.issueUrl ? ` (${bug.issueUrl})` : ""}`,
		),
	].join("\n");
}
