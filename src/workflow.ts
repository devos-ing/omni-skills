import { runPlanSession, runResumeSession, runReviewSession } from "./codex";
import { type LoadedConfig, getProjectById } from "./config";
import {
	commentOnPr,
	createBugIssues,
	createDraftPrFromWorktree,
} from "./github";
import { LinearClient } from "./linear";
import { logger, normalizeError } from "./logger";
import {
	buildImplementPrompt,
	buildPlanPrompt,
	buildReviewPrompt,
} from "./prompts";
import {
	loadRunState,
	normalizeIssueKey,
	saveRunState,
	transitionStage,
} from "./state";
import type {
	BugRecord,
	ResolvedProjectConfig,
	RunOptions,
	RunState,
} from "./types";

export async function runWorkflow(
	config: LoadedConfig,
	options: RunOptions,
): Promise<void> {
	const projects = pickProjects(config, options);
	if (projects.length === 0) {
		logger.info("No project selected.");
		return;
	}

	for (const project of projects) {
		await runProjectWorkflow(project, options);
	}
}

function pickProjects(
	config: LoadedConfig,
	options: RunOptions,
): ResolvedProjectConfig[] {
	if (options.projectId) {
		const project = getProjectById(config, options.projectId);
		if (!project) {
			throw new Error(`Project '${options.projectId}' not found`);
		}
		return [project];
	}
	if (options.allProjects) {
		return config.projects;
	}
	return config.projects.slice(0, 1);
}

async function runProjectWorkflow(
	config: ResolvedProjectConfig,
	options: RunOptions,
): Promise<void> {
	const linear = new LinearClient(config);
	const projectLogger = logger.child({ projectId: config.id });
	const polling = resolvePollingSettings(config, options);
	let cycle = 0;

	while (true) {
		cycle += 1;
		const issues = await linear.fetchWork(options.issueArg);
		projectLogger.info(
			{ cycle, issueCount: issues.length, pollingEnabled: polling.enabled },
			"Fetched eligible Linear issues",
		);

		if (issues.length === 0) {
			projectLogger.info({ cycle }, "No eligible Linear issues found.");
		}

		for (const issue of issues) {
			await processIssue(config, linear, issue);
		}

		if (!polling.enabled || options.issueArg) {
			return;
		}
		if (polling.maxCycles !== undefined && cycle >= polling.maxCycles) {
			projectLogger.info(
				{ cycle, maxCycles: polling.maxCycles },
				"Polling stopped after reaching configured max cycles",
			);
			return;
		}
		if (issues.length === 0 && polling.exitWhenIdle) {
			projectLogger.info({ cycle }, "Polling exited after idle cycle.");
			return;
		}

		await sleep(polling.intervalMs);
	}
}

async function processIssue(
	config: ResolvedProjectConfig,
	linear: LinearClient,
	issue: { id: string; identifier: string; title: string; url: string },
): Promise<void> {
	const key = normalizeIssueKey(issue.identifier);
	const issueLogger = logger.child({ projectId: config.id, issueKey: key });
	const existing = await loadRunState(config.workspacePath, config.id, key);
	const runState: RunState =
		existing ??
		({
			projectId: config.id,
			projectName: config.name,
			workspacePath: config.executionPath,
			repository: {
				owner: config.repo.owner,
				name: config.repo.name,
				baseBranch: config.repo.baseBranch,
			},
			issue: {
				id: issue.id,
				key,
				title: issue.title,
				url: issue.url,
			},
			stage: "received",
			bugs: [],
			startedAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		} satisfies RunState);

	try {
		await executeIssue(config, linear, runState);
		issueLogger.info({ stage: runState.stage }, "Issue workflow finished");
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		runState.lastError = message;
		runState.stage = "blocked";
		await saveRunState(config.workspacePath, runState);
		await safeLinearStageUpdate(linear, runState.issue.id, "blocked");
		await safeLinearComment(
			linear,
			runState.issue.id,
			`PIV loop failed and marked blocked.\n\nError:\n${message}`,
		);
		issueLogger.error(
			{
				err: normalizeError(error),
				stage: runState.stage,
			},
			"Issue workflow failed",
		);
	}
}

export interface PollingSettings {
	enabled: boolean;
	intervalMs: number;
	maxCycles?: number;
	exitWhenIdle: boolean;
}

export function resolvePollingSettings(
	config: ResolvedProjectConfig,
	options: RunOptions,
): PollingSettings {
	return {
		enabled: options.poll === true,
		intervalMs: options.pollIntervalMs ?? config.polling.intervalMs,
		maxCycles: options.maxPollCycles ?? config.polling.maxCycles,
		exitWhenIdle: options.exitWhenIdle ?? config.polling.exitWhenIdle,
	};
}

export async function sleep(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

async function executeIssue(
	config: ResolvedProjectConfig,
	linear: LinearClient,
	state: RunState,
): Promise<void> {
	if (state.stage === "done" || state.stage === "blocked") {
		return;
	}

	if (state.stage === "received") {
		await linear.markStage(state.issue.id, "planning");
		await linear.comment(state.issue.id, "PIV loop started planning.");
		Object.assign(state, transitionStage(state, "planning"));
		await saveRunState(config.workspacePath, state);
	}

	if (state.stage === "planning") {
		const prompt = await buildPlanPrompt(config.skills.plan, state.issue);
		const result = await runPlanSession(config, prompt);
		state.codexSessionId = result.sessionId ?? state.codexSessionId;
		state.planSummary = result.finalMessage || result.stdout;
		Object.assign(state, transitionStage(state, "implementing"));
		await saveRunState(config.workspacePath, state);
		await linear.markStage(state.issue.id, "implementing");
		await linear.comment(
			state.issue.id,
			buildPlanComment(state.issue.key, state.planSummary),
		);
	}

	if (state.stage === "implementing") {
		if (!state.codexSessionId) {
			throw new Error("Missing codex session id for implement step");
		}
		const prompt = await buildImplementPrompt(
			config.skills.implement,
			state.issue,
			state.planSummary ?? "",
		);
		const result = await runResumeSession(config, state.codexSessionId, prompt);
		state.implementationSummary = result.finalMessage || result.stdout;

		if (config.dryRun) {
			state.pullRequest = {
				branch: `codex/${state.issue.key.toLowerCase()}`,
				title: `[codex] ${state.issue.key}: ${state.issue.title}`,
				url: "https://example.invalid/dry-run",
			};
		} else {
			state.pullRequest = await createDraftPrFromWorktree(
				config,
				state.issue.key,
				state.issue.title,
			);
		}

		Object.assign(state, transitionStage(state, "pr_created"));
		await saveRunState(config.workspacePath, state);
		await linear.markStage(state.issue.id, "pr_created");
		await linear.applyStageLabel(state.issue.id, "pr_created");
		await linear.comment(
			state.issue.id,
			`Implementation completed. Draft PR: ${state.pullRequest.url ?? "(created)"}`,
		);
	}

	if (state.stage === "pr_created") {
		Object.assign(state, transitionStage(state, "reviewing"));
		await saveRunState(config.workspacePath, state);
		await linear.markStage(state.issue.id, "reviewing");
		await linear.applyStageLabel(state.issue.id, "reviewing");
	}

	if (state.stage === "reviewing" || state.stage === "testing") {
		await linear.markStage(state.issue.id, "testing");
		await linear.applyStageLabel(state.issue.id, "testing");
		Object.assign(state, transitionStage(state, "testing"));
		await saveRunState(config.workspacePath, state);

		const prompt = await buildReviewPrompt(
			config.skills.reviewTest,
			state.issue,
			state.pullRequest,
		);
		const review = await runReviewSession(config, prompt);
		const outcome = parseReviewOutcome(review.finalMessage || review.stdout);

		state.reviewSummary = outcome.summary;
		state.testingSummary = outcome.summary;
		state.bugs = outcome.bugs;
		await saveRunState(config.workspacePath, state);

		const reviewComment = [
			`PIV loop review for ${state.issue.key}`,
			"",
			`Result: ${outcome.passed ? "PASS" : "FAIL"}`,
			"",
			outcome.summary,
			"",
			outcome.bugs.length > 0
				? "Bugs were detected and converted to GitHub issues."
				: "No bugs found.",
		].join("\n");

		if (!config.dryRun && state.pullRequest) {
			await commentOnPr(config, state.pullRequest, reviewComment);
		}
		await linear.comment(state.issue.id, reviewComment);

		if (outcome.bugs.length > 0) {
			if (config.dryRun) {
				state.bugs = outcome.bugs;
			} else {
				state.bugs = await createBugIssues(
					config,
					outcome.bugs,
					state.issue.url,
					state.pullRequest?.url,
				);
			}
			Object.assign(state, transitionStage(state, "blocked"));
			await saveRunState(config.workspacePath, state);
			await linear.markStage(state.issue.id, "blocked");
			await linear.comment(
				state.issue.id,
				[
					"Review/testing found bugs. Marked as blocked.",
					...state.bugs.map(
						(bug) =>
							`- ${bug.title}${bug.issueUrl ? ` (${bug.issueUrl})` : ""}`,
					),
				].join("\n"),
			);
			return;
		}

		Object.assign(state, transitionStage(state, "done"));
		await saveRunState(config.workspacePath, state);
		await linear.markStage(state.issue.id, "done");
		await linear.comment(state.issue.id, "Review/testing passed. Marked done.");
	}
}

export interface ReviewOutcome {
	passed: boolean;
	summary: string;
	bugs: BugRecord[];
}

export function buildPlanComment(
	issueKey: string,
	planSummary: string,
): string {
	const maxSummaryLength = 6000;
	const normalized = planSummary.trim();
	const truncated =
		normalized.length > maxSummaryLength
			? `${normalized.slice(0, maxSummaryLength)}\n\n[truncated]`
			: normalized;

	return [
		`PIV loop plan for ${issueKey}`,
		"",
		"Planning completed; implementation started.",
		"",
		"Plan:",
		truncated || "(No plan summary returned by planning agent.)",
	].join("\n");
}

export function parseReviewOutcome(text: string): ReviewOutcome {
	const upper = text.toUpperCase();
	const passed =
		upper.includes("RESULT: PASS") && !upper.includes("RESULT: FAIL");
	const summary = extractSummary(text);
	const bugs = extractBugs(text);
	return {
		passed: passed && bugs.length === 0,
		summary,
		bugs,
	};
}

function extractSummary(text: string): string {
	const match = text.match(/SUMMARY:\s*([\s\S]*?)(?:\nBUGS_JSON:|$)/i);
	if (match?.[1]) {
		return match[1].trim();
	}
	return text.trim().slice(0, 1200);
}

function extractBugs(text: string): BugRecord[] {
	const jsonFromLabel = text.match(/BUGS_JSON:\s*([\s\S]*)$/i)?.[1]?.trim();
	if (jsonFromLabel) {
		const parsed = parseBugJson(jsonFromLabel);
		if (parsed.length > 0) {
			return parsed;
		}
	}

	const fenced = text.match(/```json\s*([\s\S]*?)```/i)?.[1]?.trim();
	if (fenced) {
		const parsed = parseBugJson(fenced);
		if (parsed.length > 0) {
			return parsed;
		}
	}

	return [];
}

function parseBugJson(input: string): BugRecord[] {
	try {
		const parsed = JSON.parse(input) as unknown;
		if (Array.isArray(parsed)) {
			return parsed
				.map((item) => {
					if (!item || typeof item !== "object") {
						return null;
					}
					const bug = item as Record<string, unknown>;
					if (typeof bug.title !== "string" || typeof bug.body !== "string") {
						return null;
					}
					return {
						title: bug.title,
						body: bug.body,
					} satisfies BugRecord;
				})
				.filter((item): item is BugRecord => item !== null);
		}
	} catch {
		return [];
	}
	return [];
}

async function safeLinearComment(
	linear: LinearClient,
	issueId: string,
	body: string,
): Promise<void> {
	const runLogger = logger.child({ issueId });
	try {
		await linear.comment(issueId, body);
	} catch (error) {
		runLogger.error(
			{ err: normalizeError(error) },
			"Failed to add Linear comment",
		);
	}
}

async function safeLinearStageUpdate(
	linear: LinearClient,
	issueId: string,
	stage: keyof ResolvedProjectConfig["linear"]["statusMap"],
): Promise<void> {
	const runLogger = logger.child({ issueId, stage });
	try {
		await linear.markStage(issueId, stage);
	} catch (error) {
		runLogger.error(
			{ err: normalizeError(error) },
			"Failed to update Linear stage",
		);
	}
}
