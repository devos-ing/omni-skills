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
	CodexUsageRecord,
	PollingConfig,
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

	const projectContexts = projects.map((project) => ({
		config: project,
		linear: new LinearClient(project),
	}));
	const globalPolling = resolvePollingSettings(config.polling, options);
	let cycle = 0;

	while (true) {
		cycle += 1;
		let totalIssues = 0;

		for (const context of projectContexts) {
			totalIssues += await runProjectCycle(
				context.config,
				options,
				context.linear,
				cycle,
				globalPolling,
			);
		}

		if (shouldStopPolling(globalPolling, options, cycle, totalIssues)) {
			return;
		}

		await sleep(globalPolling.intervalMs);
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

export function shouldStopPolling(
	polling: PollingSettings,
	options: RunOptions,
	cycle: number,
	totalIssues: number,
): boolean {
	if (!polling.enabled || options.issueArg) {
		return true;
	}
	if (polling.maxCycles !== undefined && cycle >= polling.maxCycles) {
		return true;
	}
	if (totalIssues === 0 && polling.exitWhenIdle) {
		return true;
	}
	return false;
}

async function runProjectCycle(
	config: ResolvedProjectConfig,
	options: RunOptions,
	linear: LinearClient,
	cycle: number,
	polling: PollingSettings,
): Promise<number> {
	const projectLogger = logger.child({ projectId: config.id });
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

	return issues.length;
}

async function processIssue(
	config: ResolvedProjectConfig,
	linear: LinearClient,
	issue: {
		id: string;
		identifier: string;
		title: string;
		url: string;
		state: {
			id: string;
			name: string;
		};
	},
): Promise<void> {
	const key = normalizeIssueKey(issue.identifier);
	const issueLogger = logger.child({ projectId: config.id, issueKey: key });
	const existing = await loadRunState(config.workspacePath, config.id, key);
	const isAssignedState = await linear.isAssignedState(issue.state.id);
	if (!existing && !isAssignedState) {
		issueLogger.info(
			{ issueState: issue.state.name, issueStateId: issue.state.id },
			"Skipping in-progress issue without resumable local run state",
		);
		return;
	}
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
	issueLogger.info(
		buildIssueJobLogFields(runState, runState.stage, {
			resumed: existing !== null,
		}),
		"Taking issue job",
	);

	try {
		await executeIssue(config, linear, runState);
		issueLogger.info({ stage: runState.stage }, "Issue workflow finished");
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		runState.lastError = message;
		runState.stage = "blocked";
		await saveRunState(config.workspacePath, runState);
		await safeLinearMoveToCanceled(linear, runState.issue.id);
		await safeLinearComment(
			linear,
			runState.issue.id,
			`PIV loop failed and moved issue to Canceled.\n\nError:\n${message}`,
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
	pollingConfig: PollingConfig,
	options: RunOptions,
): PollingSettings {
	return {
		enabled: options.poll === true,
		intervalMs: options.pollIntervalMs ?? pollingConfig.intervalMs,
		maxCycles: options.maxPollCycles ?? pollingConfig.maxCycles,
		exitWhenIdle: options.exitWhenIdle ?? pollingConfig.exitWhenIdle,
	};
}

export async function sleep(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

export interface IssueJobLogFields {
	projectId: string;
	issueKey: string;
	issueId: string;
	issueTitle: string;
	stage: string;
	resumed?: true;
}

export function buildIssueJobLogFields(
	state: RunState,
	stage: string,
	options?: { resumed?: boolean },
): IssueJobLogFields {
	return {
		projectId: state.projectId,
		issueKey: state.issue.key,
		issueId: state.issue.id,
		issueTitle: state.issue.title,
		stage,
		...(options?.resumed ? { resumed: true as const } : {}),
	};
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
		logger.info(buildIssueJobLogFields(state, "planning"), "Planning issue");
		const prompt = await buildPlanPrompt(config.skills.plan, state.issue);
		const result = await runPlanSession(config, prompt);
		state.codexSessionId = result.sessionId ?? state.codexSessionId;
		state.planSummary = result.finalMessage || result.stdout;
		appendCodexUsage(state, "planning", result.usage);
		Object.assign(state, transitionStage(state, "implementing"));
		await saveRunState(config.workspacePath, state);
		await linear.markStage(state.issue.id, "implementing");
		await linear.comment(
			state.issue.id,
			buildPlanComment(state.issue.key, state.planSummary, result.usage),
		);
		logger.info(buildIssueJobLogFields(state, "planning"), "Plan completed");
	}

	if (state.stage === "implementing") {
		if (!state.codexSessionId) {
			throw new Error("Missing codex session id for implement step");
		}
		logger.info(
			buildIssueJobLogFields(state, "implementing"),
			"Implementing issue",
		);
		const prompt = await buildImplementPrompt(
			config.skills.implement,
			state.issue,
			state.planSummary ?? "",
		);
		const result = await runResumeSession(config, state.codexSessionId, prompt);
		state.implementationSummary = result.finalMessage || result.stdout;
		appendCodexUsage(state, "implementing", result.usage);

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
			[
				`Implementation completed. Draft PR: ${state.pullRequest.url ?? "(created)"}`,
				formatCodexUsageLine(result.usage),
			].join("\n"),
		);
		logger.info(
			buildIssueJobLogFields(state, "implementing"),
			"Implementation completed",
		);
	}

	if (state.stage === "pr_created") {
		Object.assign(state, transitionStage(state, "reviewing"));
		await saveRunState(config.workspacePath, state);
		await linear.markStage(state.issue.id, "reviewing");
		await linear.applyStageLabel(state.issue.id, "reviewing");
	}

	if (state.stage === "reviewing" || state.stage === "testing") {
		logger.info(buildIssueJobLogFields(state, "testing"), "Testing issue");
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
		appendCodexUsage(state, "testing", review.usage);

		state.reviewSummary = outcome.summary;
		state.testingSummary = outcome.summary;
		state.bugs = outcome.bugs;
		await saveRunState(config.workspacePath, state);

		const reviewComment = [
			`PIV loop review for ${state.issue.key}`,
			"",
			`Result: ${outcome.passed ? "PASS" : "FAIL"}`,
			"",
			formatCodexUsageLine(review.usage),
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
			await linear.markCanceled(state.issue.id);
			await linear.comment(
				state.issue.id,
				[
					"Review/testing found bugs. Moved issue to Canceled.",
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
		logger.info(
			buildIssueJobLogFields(state, "testing"),
			"Review/testing completed",
		);
	}
}

export function appendCodexUsage(
	state: RunState,
	stage: CodexUsageRecord["stage"],
	usage:
		| { inputTokens?: number; outputTokens?: number; totalTokens?: number }
		| undefined,
): void {
	if (!usage) {
		return;
	}
	state.codexUsage = [
		...(state.codexUsage ?? []),
		{
			stage,
			inputTokens: usage.inputTokens,
			outputTokens: usage.outputTokens,
			totalTokens: usage.totalTokens,
			recordedAt: new Date().toISOString(),
		},
	];
}

export interface ReviewOutcome {
	passed: boolean;
	summary: string;
	bugs: BugRecord[];
}

export function buildPlanComment(
	issueKey: string,
	planSummary: string,
	usage?: {
		inputTokens?: number;
		outputTokens?: number;
		totalTokens?: number;
	},
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
		formatCodexUsageLine(usage),
		"",
		"Plan:",
		truncated || "(No plan summary returned by planning agent.)",
	].join("\n");
}

export function formatCodexUsageLine(usage?: {
	inputTokens?: number;
	outputTokens?: number;
	totalTokens?: number;
}): string {
	if (!usage) {
		return "Token usage: unknown";
	}
	const input = usage.inputTokens ?? "unknown";
	const output = usage.outputTokens ?? "unknown";
	const total =
		usage.totalTokens ??
		(typeof usage.inputTokens === "number" &&
		typeof usage.outputTokens === "number"
			? usage.inputTokens + usage.outputTokens
			: "unknown");
	return `Token usage: input ${input}, output ${output}, total ${total}`;
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

async function safeLinearMoveToCanceled(
	linear: LinearClient,
	issueId: string,
): Promise<void> {
	const runLogger = logger.child({ issueId, stage: "canceled" });
	try {
		await linear.markCanceled(issueId);
	} catch (error) {
		runLogger.error(
			{ err: normalizeError(error) },
			"Failed to move Linear issue to Canceled",
		);
	}
}
