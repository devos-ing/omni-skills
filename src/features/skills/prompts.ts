import { readFile } from "node:fs/promises";
import type { BugRecord, IssueRef, PullRequestRef } from "../../core/types";
import type { PlanPromptOptions } from "./prompt-types";

async function loadSkillText(filePath: string): Promise<string> {
	try {
		return (await readFile(filePath, "utf8")).trim();
	} catch {
		return "No skill file was found. Follow workflow instructions directly.";
	}
}

export async function buildPlanPrompt(
	skillPath: string,
	issue: IssueRef,
	options?: PlanPromptOptions,
): Promise<string> {
	const skill = await loadSkillText(skillPath);
	const supplementalSkills = options?.supplementalSkills ?? [];
	const warnings = options?.autoSelectWarnings ?? [];
	const issueDescription = issue.description?.trim();

	const supplementalSection =
		supplementalSkills.length > 0 || warnings.length > 0
			? [
					"",
					"Auto-selected supplemental skills:",
					...supplementalSkills.flatMap((selected, index) => {
						const content = selected.content?.trim();
						return [
							`${index + 1}. ${selected.name}`,
							`   - source: ${selected.source}`,
							`   - score: ${selected.score}`,
							...(selected.description
								? [`   - description: ${selected.description}`]
								: []),
							...(selected.path ? [`   - path: ${selected.path}`] : []),
							...(content ? ["   - content:", content] : []),
						];
					}),
					...(warnings.length > 0
						? ["", "Auto-selection notes:", ...warnings.map((w) => `- ${w}`)]
						: []),
				].join("\n")
			: "";

	return [
		"You are the planning agent in the Agent-Driven Development Hub (ADHD.ai) workflow.",
		"ADHD.ai already refreshed the repository base branch before launching you; do not run git fetch or git pull.",
		"",
		"Use this skill:",
		skill,
		"",
		`Linear issue: ${issue.key}`,
		`Title: ${issue.title}`,
		...(issueDescription ? [`Description: ${issueDescription}`] : []),
		`URL: ${issue.url}`,
		supplementalSection,
		"",
		"Include ISSUE_REFINEMENT_JSON with a refined title and description that preserve original user intent and do not invent scope.",
		"When including SPLIT_TASKS_JSON, write action-oriented task titles and clear descriptions that include expected behavior, implementation scope, and tests.",
		"Create a concrete implementation plan and include risks and tests.",
	].join("\n");
}

export async function buildImplementPrompt(
	skillPath: string,
	issue: IssueRef,
	planSummary: string,
): Promise<string> {
	const skill = await loadSkillText(skillPath);
	return [
		"You are the implementation agent in the Agent-Driven Development Hub (ADHD.ai) workflow.",
		"ADHD.ai already refreshed the repository base branch before launching you; do not run git fetch or git pull.",
		"",
		"Use this skill:",
		skill,
		"",
		`Linear issue: ${issue.key}`,
		`Title: ${issue.title}`,
		"",
		"Plan summary:",
		planSummary,
		"",
		"Implement the task in the current workspace and run relevant tests. End with a concise summary.",
	].join("\n");
}

export async function buildReviewPrompt(
	skillPath: string,
	issue: IssueRef,
	pr: PullRequestRef | undefined,
): Promise<string> {
	const skill = await loadSkillText(skillPath);
	const prText = pr?.url
		? `PR: ${pr.url}`
		: `Branch: ${pr?.branch ?? "unknown"}`;
	return [
		"You are the review and testing agent in the Agent-Driven Development Hub (ADHD.ai) workflow.",
		"ADHD.ai already refreshed the repository base branch before launching you; do not run git fetch or git pull.",
		"",
		"Use this skill:",
		skill,
		"",
		`Linear issue: ${issue.key}`,
		prText,
		"",
		"Review code changes and run `bun test` to verify the workspace is workable. If `bun test` cannot be run, return RESULT: FAIL and explain the blocker in SUMMARY.",
		"Return your final section in this exact format:",
		"RESULT: PASS or FAIL",
		"SUMMARY: <one-paragraph summary>",
		"BUGS_JSON:",
		'[{"title":"short bug title","body":"technical details"}]',
	].join("\n");
}

export async function buildFixPrompt(
	skillPath: string,
	issue: IssueRef,
	planSummary: string,
	reviewSummary: string,
	bugs: BugRecord[],
	pr: PullRequestRef | undefined,
): Promise<string> {
	const skill = await loadSkillText(skillPath);
	const bugJson = JSON.stringify(bugs, null, 2);
	const prText = pr?.url
		? `PR: ${pr.url}`
		: `Branch: ${pr?.branch ?? "unknown"}`;
	return [
		"You are the implementation agent in the Agent-Driven Development Hub (ADHD.ai) workflow.",
		"ADHD.ai already refreshed the repository base branch before launching you; do not run git fetch or git pull.",
		"",
		"Use this skill:",
		skill,
		"",
		`Linear issue: ${issue.key}`,
		`Title: ${issue.title}`,
		prText,
		"",
		"This is a fix pass after review/testing found bugs.",
		"",
		"Plan summary:",
		planSummary || "(none)",
		"",
		"Latest review/testing summary:",
		reviewSummary || "(none)",
		"",
		"Bugs to fix (BUGS_JSON):",
		bugJson,
		"",
		"Address every bug, update the existing branch/PR, run relevant tests, and end with a concise summary.",
	].join("\n");
}
