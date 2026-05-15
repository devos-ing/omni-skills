import { readFile } from "node:fs/promises";
import type { BugRecord, IssueRef, PullRequestRef } from "../../features/types";
import type { PlanPromptOptions, ReviewPromptOptions } from "./prompt-types";

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
	const parentIssue = issue.parentIssue;

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
		"You are the planning agent in the devos.ing ADHD (Agentic Development Hub & Daemon) workflow.",
		"devos.ing already refreshed the repository base branch before launching you; do not run git fetch or git pull.",
		"",
		"Use this skill:",
		skill,
		"",
		`Linear issue: ${issue.key}`,
		`Title: ${issue.title}`,
		...(issueDescription ? [`Description: ${issueDescription}`] : []),
		`URL: ${issue.url}`,
		...(parentIssue
			? [
					`Parent issue: ${parentIssue.key} - ${parentIssue.title}`,
					`Parent URL: ${parentIssue.url}`,
					"Continue under the parent task context; keep this child issue scoped to its assigned subtask.",
				]
			: []),
		supplementalSection,
		"",
		"Return exactly one planning route: PLANNING_RESULT: READY or PLANNING_RESULT: NEEDS_INFO.",
		"For READY, include ISSUE_REFINEMENT_JSON with a refined title and description that preserve original user intent and do not invent scope.",
		"For READY, include SUCCESS_GOAL with the concise acceptance goal that review/testing must use as the success scope.",
		"For NEEDS_INFO, include QUESTIONS_JSON with one to three concise clarification questions and do not include SUCCESS_GOAL.",
		"Do not invent a success goal when acceptance criteria are unclear; use NEEDS_INFO instead.",
		"When including SPLIT_TASKS_JSON, write action-oriented task titles and clear descriptions that include expected behavior, implementation scope, and tests.",
		"Create a concrete implementation plan and format the READY narrative with these headings in order: Title, Summary, Key Changes, Checkpoints (Steps), Test plan, Assumptions.",
		"In Checkpoints (Steps), break meaningful requirements into ordered progress checkpoints; each checkpoint must name the implementation target and validation/progress signal.",
		"Use Assumptions for explicit assumptions only; write None when there are no assumptions.",
	].join("\n");
}

export async function buildImplementPrompt(
	skillPath: string,
	issue: IssueRef,
	planSummary: string,
): Promise<string> {
	const skill = await loadSkillText(skillPath);
	return [
		"You are the implementation agent in the devos.ing ADHD (Agentic Development Hub & Daemon) workflow.",
		"devos.ing already refreshed the repository base branch before launching you; do not run git fetch or git pull.",
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
		"Before editing, restate the scoped plan and the ordered Checkpoints (Steps) list as your progress plan.",
		"Implement the task checkpoint-by-checkpoint in the current workspace and run relevant tests.",
		"End with a concise summary that lists completed checkpoints, blocked checkpoints if any, checks run, and remaining risk.",
	].join("\n");
}

export async function buildReviewPrompt(
	skillPath: string,
	issue: IssueRef,
	pr: PullRequestRef | undefined,
	options?: ReviewPromptOptions,
): Promise<string> {
	const skill = await loadSkillText(skillPath);
	const prText = pr?.url
		? `PR: ${pr.url}`
		: `Branch: ${pr?.branch ?? "unknown"}`;
	const successGoal = options?.successGoal?.trim();
	const planSummary = options?.planSummary?.trim();
	const successScope = successGoal
		? ["Success goal:", successGoal]
		: [
				"Success scope fallback from plan summary:",
				planSummary || "(No plan summary was captured.)",
			];
	return [
		"You are the review and testing agent in the devos.ing ADHD (Agentic Development Hub & Daemon) workflow.",
		"devos.ing already refreshed the repository base branch before launching you; do not run git fetch or git pull.",
		"",
		"Use this skill:",
		skill,
		"",
		`Linear issue: ${issue.key}`,
		prText,
		"",
		...successScope,
		"",
		"Use the success scope above as the acceptance boundary. Verify the implementation satisfies it, and do not widen requirements beyond it.",
		"",
		"Review code changes and run `bun test` to verify the workspace is workable. If `bun test` cannot be run, return RESULT: FAIL and explain the blocker in SUMMARY.",
		"When returning RESULT: FAIL, each BUGS_JSON item body must be a structured repair checklist with: failing command or reproduction step, observed behavior, expected behavior, likely files or code path, concrete fix expectation, and verification command/check.",
		"Return your final section in this exact format:",
		"RESULT: PASS or FAIL",
		"SUMMARY: <one-paragraph summary>",
		"BUGS_JSON:",
		'[{"title":"short bug title","body":"Failing command/repro: ...\\nObserved: ...\\nExpected: ...\\nLikely files/code path: ...\\nFix expectation: ...\\nVerification: ..."}]',
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
		"You are the implementation agent in the devos.ing ADHD (Agentic Development Hub & Daemon) workflow.",
		"devos.ing already refreshed the repository base branch before launching you; do not run git fetch or git pull.",
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
		"Fix-pass instructions:",
		"- Address every bug in BUGS_JSON; treat each body as the repair checklist from review/testing.",
		"- Break the repair work into checkpointed fixes, then report each bug-fix checkpoint as completed or blocked.",
		"- Preserve unrelated user changes and avoid broad refactors outside the failing behavior.",
		"- Add or update regression tests when the fix changes behavior or guards a reported failure.",
		"- Run each listed verification command/check plus relevant repository checks for the touched code.",
		"- End with a concise summary that names the bugs fixed, completed and blocked checkpoints, checks that passed, and remaining risk.",
	].join("\n");
}

export async function buildGithubCommentPrompt(
	skillPath: string,
	issue: IssueRef,
	pr: PullRequestRef,
	input: {
		passed: boolean;
		summary: string;
		bugs: BugRecord[];
	},
): Promise<string> {
	const skill = await loadSkillText(skillPath);
	return [
		"You are the github-comment agent in the devos.ing ADHD (Agentic Development Hub & Daemon) workflow.",
		"devos.ing already refreshed the repository base branch before launching you; do not run git fetch or git pull.",
		"",
		"Use this skill:",
		skill,
		"",
		`Linear issue: ${issue.key}`,
		`PR: ${pr.url ?? pr.branch}`,
		"",
		`Review result: ${input.passed ? "PASS" : "FAIL"}`,
		"Review summary:",
		input.summary || "(none)",
		"",
		"Bugs (BUGS_JSON):",
		JSON.stringify(input.bugs, null, 2),
		"",
		"Return only the final Markdown PR comment body.",
	].join("\n");
}
