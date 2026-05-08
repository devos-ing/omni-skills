import {
	commentOnPr,
	createDraftPrFromWorktree,
	issueBranchName,
	prepareImplementationBranch,
	updateDraftPrFromWorktree,
} from "../services/github";
import { LinearClient } from "../services/linear";
import { sendTaskOutcomeEmail } from "../services/notifications";
import {
	buildFixPrompt,
	buildImplementPrompt,
	buildPlanPrompt,
	buildReviewPrompt,
} from "../skills/prompts";
import {
	buildImplementationComment,
	buildPlanComment,
	buildPlanSplitComment,
	buildReviewComment,
} from "../utils/comments";
import { logger, normalizeError } from "../utils/logger";
import { type AgentAdapter, createAgentAdapter } from "./agent-adapter";
import { type LoadedConfig, getProjectById } from "./config";
import { type ReviewOutcome, parseReviewOutcome } from "./review";
import {
	appendProjectErrorLog,
	applyRunLease,
	clearRunLease,
	hasRunLeaseConflict,
	isRunLeaseExpired,
	listRunStates,
	loadRunState,
	normalizeIssueKey,
	projectErrorLogPath,
	saveRunState,
	transitionStage,
} from "./state";
import type {
	CodexUsageRecord,
	PlannedSplitTask,
	PollingConfig,
	ResolvedNotificationConfig,
	ResolvedProjectConfig,
	RunOptions,
	RunState,
	WorkflowStage,
} from "./types";

interface WorkflowIssue {
	id: string;
	identifier: string;
	title: string;
	url: string;
	teamId?: string;
	state: {
		id: string;
		name: string;
	};
}

export async function runWorkflow(
	config: LoadedConfig,
	options: RunOptions,
): Promise<void> {
	const projects = pickProjects(config, options);
	if (projects.length === 0) {
		logger.info("No project selected.");
		return;
	}

	let projectContexts = projects.map((project) => ({
		config: project,
		linear: new LinearClient(project),
	}));

	if (options.issueArg && options.allProjects && !options.projectId) {
		projectContexts = await routeProjectContextsForTargetIssue(
			projectContexts,
			options.issueArg,
		);
		if (projectContexts.length === 0) {
			return;
		}
	}
	const globalPolling = resolvePollingSettings(config.polling, options);
	let cycle = 0;

	while (true) {
		cycle += 1;
		let totalIssues = 0;
		let cycleHadError = false;

		for (const context of projectContexts) {
			try {
				totalIssues += await runProjectCycle(
					context.config,
					config.notifications,
					options,
					context.linear,
					cycle,
					globalPolling,
				);
			} catch (error) {
				if (!globalPolling.enabled || options.issueArg) {
					throw error;
				}
				cycleHadError = true;
				const message = error instanceof Error ? error.message : String(error);
				const errorLogPath = projectErrorLogPath(
					context.config.workspacePath,
					context.config.id,
				);
				try {
					await appendProjectErrorLog(
						context.config.workspacePath,
						context.config.id,
						{
							cycle,
							message,
							error: normalizeError(error),
							context: {
								projectName: context.config.name,
								pollingIntervalMs: globalPolling.intervalMs,
								issueArg: options.issueArg ?? null,
							},
						},
					);
				} catch (appendError) {
					logger.error(
						{
							projectId: context.config.id,
							cycle,
							errorLogPath,
							err: normalizeError(appendError),
						},
						"Failed to append polling error log entry",
					);
				}
				logger.error(
					{
						projectId: context.config.id,
						cycle,
						errorLogPath,
						err: normalizeError(error),
					},
					"Project cycle failed during polling; continuing",
				);
			}
		}

		if (
			shouldStopPolling(
				globalPolling,
				options,
				cycle,
				totalIssues,
				cycleHadError,
			)
		) {
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

async function routeProjectContextsForTargetIssue(
	contexts: Array<{ config: ResolvedProjectConfig; linear: LinearClient }>,
	issueArg: string,
): Promise<Array<{ config: ResolvedProjectConfig; linear: LinearClient }>> {
	const routeLogger = logger.child({ issueArg });
	const issue = await contexts[0]?.linear.fetchIssueByIdentifier(issueArg);
	if (!issue) {
		routeLogger.info("Target issue was not found; skipping run.");
		return [];
	}

	const routing = routeProjectsForIssueProjectId(
		contexts.map((context) => context.config),
		issue.projectId,
	);
	if (routing.error) {
		throw new Error(routing.error);
	}
	if (!routing.selectedProjectId) {
		routeLogger.info(
			{
				issueKey: issue.identifier,
				issueProjectId: issue.projectId ?? null,
				reason: routing.skipReason,
			},
			"Target issue is not routable to any configured project; skipping run",
		);
		return [];
	}

	const selected = contexts.filter(
		(context) => context.config.id === routing.selectedProjectId,
	);
	routeLogger.info(
		{
			issueKey: issue.identifier,
			issueProjectId: issue.projectId ?? null,
			projectId: routing.selectedProjectId,
		},
		"Routed target issue to project by Linear project id",
	);
	return selected;
}

export interface IssueProjectRoutingResult {
	selectedProjectId?: string;
	skipReason?: string;
	error?: string;
}

export function routeProjectsForIssueProjectId(
	projects: ResolvedProjectConfig[],
	issueProjectId: string | undefined,
): IssueProjectRoutingResult {
	const scopedProjects = projects.filter((project) => project.linear.projectId);
	const unscopedProjects = projects.filter(
		(project) => !project.linear.projectId,
	);

	if (!issueProjectId) {
		if (unscopedProjects.length > 1) {
			return {
				error:
					"Target issue has no Linear project id and multiple unscoped projects are configured. Re-run with --project <PROJECT_ID>.",
			};
		}
		return {
			skipReason:
				"Target issue has no Linear project id and cannot be safely routed in --all-projects mode.",
		};
	}

	const explicitMatches = scopedProjects.filter(
		(project) => project.linear.projectId === issueProjectId,
	);
	if (explicitMatches.length > 1) {
		return {
			error: `Multiple projects are configured with linear.projectId='${issueProjectId}'. Re-run with --project <PROJECT_ID>.`,
		};
	}
	if (explicitMatches.length === 1) {
		return {
			selectedProjectId: explicitMatches[0]?.id,
		};
	}
	if (unscopedProjects.length > 1) {
		return {
			error:
				"No explicit linear.projectId match was found and multiple unscoped projects are configured. Re-run with --project <PROJECT_ID>.",
		};
	}
	return {
		skipReason: `No project configured for linear.projectId='${issueProjectId}'.`,
	};
}

export function shouldStopPolling(
	polling: PollingSettings,
	options: RunOptions,
	cycle: number,
	totalIssues: number,
	cycleHadError = false,
): boolean {
	if (!polling.enabled || options.issueArg) {
		return true;
	}
	if (polling.maxCycles !== undefined && cycle >= polling.maxCycles) {
		return true;
	}
	if (totalIssues === 0 && polling.exitWhenIdle && !cycleHadError) {
		return true;
	}
	return false;
}

async function runProjectCycle(
	config: ResolvedProjectConfig,
	notifications: ResolvedNotificationConfig,
	options: RunOptions,
	linear: LinearClient,
	cycle: number,
	polling: PollingSettings,
): Promise<number> {
	const projectLogger = logger.child({ projectId: config.id });
	const { issueQueue, staleRetryCount } = await buildIssueQueueForProjectCycle(
		config,
		options,
		linear,
		polling,
	);
	projectLogger.info(
		{
			cycle,
			issueCount: issueQueue.length,
			staleRetryCount,
			pollingEnabled: polling.enabled,
		},
		"Fetched eligible Linear issues",
	);

	if (issueQueue.length === 0) {
		projectLogger.info({ cycle }, "No eligible Linear issues found.");
	}

	for (const issue of issueQueue) {
		await processIssue(
			config,
			notifications,
			linear,
			issue,
			polling.staleRunTimeoutMs,
			buildRunLeaseOwnerId(),
		);
	}

	return issueQueue.length;
}

async function buildIssueQueueForProjectCycle(
	config: ResolvedProjectConfig,
	options: RunOptions,
	linear: LinearClient,
	polling: PollingSettings,
): Promise<{ issueQueue: WorkflowIssue[]; staleRetryCount: number }> {
	const assignedIssues = await linear.fetchWork(options.issueArg);
	if (options.issueArg !== undefined) {
		return { issueQueue: assignedIssues, staleRetryCount: 0 };
	}
	const staleRetryIssues = await fetchStaleIssuesForRetry(
		config,
		linear,
		polling.staleRunTimeoutMs,
		assignedIssues,
	);
	return {
		issueQueue: dedupeIssuesByKey([...assignedIssues, ...staleRetryIssues]),
		staleRetryCount: staleRetryIssues.length,
	};
}

export function shouldRetryRunStage(stage: WorkflowStage): boolean {
	return (
		stage === "received" ||
		stage === "planning" ||
		stage === "implementing" ||
		stage === "pr_created" ||
		stage === "reviewing" ||
		stage === "testing"
	);
}

export function isRunStateStaleForRetry(
	state: RunState,
	nowMs: number,
	timeoutMs: number,
): boolean {
	if (!shouldRetryRunStage(state.stage)) {
		return false;
	}
	if (!isRunLeaseExpired(state, nowMs)) {
		return false;
	}
	const updatedAtMs = Date.parse(state.updatedAt);
	if (Number.isNaN(updatedAtMs)) {
		return false;
	}
	return nowMs - updatedAtMs >= timeoutMs;
}

export function selectStaleRunIssueKeys(
	runStates: RunState[],
	nowMs: number,
	timeoutMs: number,
): string[] {
	return runStates
		.filter((state) => isRunStateStaleForRetry(state, nowMs, timeoutMs))
		.map((state) => normalizeIssueKey(state.issue.key));
}

function dedupeIssuesByKey(issues: WorkflowIssue[]): WorkflowIssue[] {
	const seen = new Set<string>();
	const unique: WorkflowIssue[] = [];
	for (const issue of issues) {
		const key = normalizeIssueKey(issue.identifier);
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		unique.push(issue);
	}
	return unique;
}

async function fetchStaleIssuesForRetry(
	config: ResolvedProjectConfig,
	linear: LinearClient,
	timeoutMs: number,
	assignedIssues: WorkflowIssue[],
): Promise<WorkflowIssue[]> {
	const runStates = await listRunStates(config.workspacePath, config.id);
	const staleRunKeys = selectStaleRunIssueKeys(
		runStates,
		Date.now(),
		timeoutMs,
	);
	const assignedIssueKeys = new Set(
		assignedIssues.map((issue) => normalizeIssueKey(issue.identifier)),
	);
	const staleUnassignedKeys = staleRunKeys.filter(
		(key) => !assignedIssueKeys.has(key),
	);
	const staleIssues: WorkflowIssue[] = [];
	for (const key of staleUnassignedKeys) {
		const issue = await linear.fetchIssueByIdentifier(key);
		if (!issue) {
			continue;
		}
		staleIssues.push({
			id: issue.id,
			identifier: issue.identifier,
			title: issue.title,
			url: issue.url,
			teamId: issue.teamId,
			state: issue.state,
		});
	}
	return staleIssues;
}

async function processIssue(
	config: ResolvedProjectConfig,
	notifications: ResolvedNotificationConfig,
	linear: LinearClient,
	issue: WorkflowIssue,
	leaseTimeoutMs: number,
	leaseOwnerId: string,
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
				teamId: issue.teamId,
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

	const leaseAcquired = await tryAcquireRunLease(
		config.workspacePath,
		runState,
		leaseOwnerId,
		leaseTimeoutMs,
	);
	if (!leaseAcquired) {
		issueLogger.info(
			{ leaseOwnerId, currentLeaseOwnerId: runState.lease?.ownerId },
			"Skipping issue because it is already leased by another worker",
		);
		return;
	}

	try {
		await executeIssue(
			config,
			notifications,
			linear,
			runState,
			leaseOwnerId,
			leaseTimeoutMs,
		);
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
			`ADHD.ai failed and moved issue to Canceled.\n\nError:\n${message}`,
		);
		issueLogger.error(
			{
				err: normalizeError(error),
				stage: runState.stage,
			},
			"Issue workflow failed",
		);
		await safeNotifyTaskOutcome(notifications, runState, "blocked", message);
	} finally {
		await releaseRunLease(config.workspacePath, runState, leaseOwnerId);
	}
}

export interface PollingSettings {
	enabled: boolean;
	intervalMs: number;
	maxCycles?: number;
	exitWhenIdle: boolean;
	staleRunTimeoutMs: number;
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
		staleRunTimeoutMs: pollingConfig.staleRunTimeoutMs,
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
	notifications: ResolvedNotificationConfig,
	linear: LinearClient,
	state: RunState,
	leaseOwnerId: string,
	leaseTimeoutMs: number,
): Promise<void> {
	const agent = createAgentAdapter(config);

	while (state.stage !== "done" && state.stage !== "blocked") {
		await heartbeatRunLease(
			config.workspacePath,
			state,
			leaseOwnerId,
			leaseTimeoutMs,
		);
		if (state.stage === "received") {
			await handleReceivedStage(config, linear, state);
			continue;
		}

		if (state.stage === "planning") {
			await handlePlanningStage(config, agent, notifications, linear, state);
			continue;
		}

		if (state.stage === "implementing") {
			await handleImplementingStage(config, agent, linear, state);
			continue;
		}

		if (state.stage === "pr_created") {
			await handlePrCreatedStage(config, linear, state);
			continue;
		}

		if (state.stage === "reviewing" || state.stage === "testing") {
			await handleReviewTestingStage(
				config,
				agent,
				notifications,
				linear,
				state,
			);
			continue;
		}

		throw new Error(`Unsupported workflow stage: ${state.stage}`);
	}
}

async function handleReceivedStage(
	config: ResolvedProjectConfig,
	linear: LinearClient,
	state: RunState,
): Promise<void> {
	await linear.markStage(state.issue.id, "planning");
	await linear.comment(state.issue.id, "ADHD.ai started planning.");
	Object.assign(state, transitionStage(state, "planning"));
	await saveRunState(config.workspacePath, state);
}

async function handlePlanningStage(
	config: ResolvedProjectConfig,
	agent: AgentAdapter,
	notifications: ResolvedNotificationConfig,
	linear: LinearClient,
	state: RunState,
): Promise<void> {
	logger.info(buildIssueJobLogFields(state, "planning"), "Planning issue");
	const prompt = await buildPlanPrompt(config.skills.plan, state.issue);
	const result = await agent.runPlan(prompt);
	state.codexSessionId = result.sessionId ?? state.codexSessionId;
	state.planSummary = result.finalMessage || result.stdout;
	appendCodexUsage(state, "planning", result.usage);

	const parsedPlan = parsePlannerDecision(state.planSummary);
	if (parsedPlan.complexity === "SIMPLE") {
		Object.assign(state, transitionStage(state, "implementing"));
		await saveRunState(config.workspacePath, state);
		await linear.markStage(state.issue.id, "implementing");
		await linear.comment(
			state.issue.id,
			buildPlanComment(state.issue.key, state.planSummary, result.usage),
		);
		logger.info(buildIssueJobLogFields(state, "planning"), "Plan completed");
		return;
	}

	const createdTasks = [];
	for (const task of parsedPlan.splitTasks) {
		const created = await linear.createTodoIssueFromPlan(state.issue, task);
		createdTasks.push({
			title: created.title,
			issueKey: created.identifier,
			issueUrl: created.url,
		});
	}
	state.splitTasks = createdTasks;
	Object.assign(state, transitionStage(state, "done"));
	await saveRunState(config.workspacePath, state);
	await linear.markStage(state.issue.id, "done");
	await linear.comment(
		state.issue.id,
		buildPlanSplitComment(state.issue.key, state.planSummary, createdTasks, {
			usage: result.usage,
		}),
	);
	await safeNotifyTaskOutcome(notifications, state, "done");
	logger.info(buildIssueJobLogFields(state, "planning"), "Plan completed");
}

async function handleImplementingStage(
	config: ResolvedProjectConfig,
	agent: AgentAdapter,
	linear: LinearClient,
	state: RunState,
): Promise<void> {
	if (!state.codexSessionId) {
		throw new Error("Missing codex session id for implement step");
	}
	logger.info(
		buildIssueJobLogFields(state, "implementing"),
		"Implementing issue",
	);

	if (!config.dryRun) {
		const preparedBranch = await prepareImplementationBranch(
			config,
			state.issue.key,
			state.pullRequest,
		);
		if (!state.pullRequest) {
			state.pullRequest = {
				branch: preparedBranch,
				title: `[codex] ${state.issue.key}: ${state.issue.title}`,
			};
		}
	}

	const hasExistingPr = Boolean(state.pullRequest?.url);
	const fixRound = hasExistingPr && state.bugs.length > 0;
	const fixedBugs = fixedBugsForImplementationComment(
		hasExistingPr,
		state.bugs,
	);
	const prompt = fixRound
		? await buildFixPrompt(
				config.skills.implement,
				state.issue,
				state.planSummary ?? "",
				state.testingSummary ?? state.reviewSummary ?? "",
				state.bugs,
				state.pullRequest,
			)
		: await buildImplementPrompt(
				config.skills.implement,
				state.issue,
				state.planSummary ?? "",
			);
	const result = await agent.resume(state.codexSessionId, prompt);
	state.implementationSummary = result.finalMessage || result.stdout;
	appendCodexUsage(state, "implementing", result.usage);

	if (!hasExistingPr) {
		if (config.dryRun) {
			state.pullRequest = {
				branch: issueBranchName(state.issue.key),
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
	} else if (!config.dryRun) {
		if (!state.pullRequest?.branch) {
			throw new Error("Missing pull request branch for feedback pass");
		}
		const updated = await updateDraftPrFromWorktree(
			config,
			state.pullRequest.branch,
			state.issue.key,
		);
		if (!updated) {
			logger.info(
				buildIssueJobLogFields(state, "implementing"),
				"No code changes after feedback; skipping PR update",
			);
		}
	}

	state.bugs = [];
	const nextStage: WorkflowStage = hasExistingPr ? "reviewing" : "pr_created";
	Object.assign(state, transitionStage(state, nextStage));
	await saveRunState(config.workspacePath, state);
	await linear.markStage(state.issue.id, nextStage);
	await linear.applyStageLabel(state.issue.id, nextStage);
	await linear.comment(
		state.issue.id,
		buildImplementationComment(state.pullRequest?.url, result.usage, {
			updated: hasExistingPr,
			fixedBugs,
		}),
	);
	logger.info(
		buildIssueJobLogFields(state, "implementing"),
		hasExistingPr
			? "Implementation feedback pass completed"
			: "Implementation completed",
	);
}

async function handlePrCreatedStage(
	config: ResolvedProjectConfig,
	linear: LinearClient,
	state: RunState,
): Promise<void> {
	Object.assign(state, transitionStage(state, "reviewing"));
	await saveRunState(config.workspacePath, state);
	await linear.markStage(state.issue.id, "reviewing");
	await linear.applyStageLabel(state.issue.id, "reviewing");
}

async function handleReviewTestingStage(
	config: ResolvedProjectConfig,
	agent: AgentAdapter,
	notifications: ResolvedNotificationConfig,
	linear: LinearClient,
	state: RunState,
): Promise<void> {
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
	const review = await agent.runReview(prompt);
	const outcome = parseReviewOutcome(review.finalMessage || review.stdout);
	const retryBugs = normalizeFailedReviewBugs(outcome);
	appendCodexUsage(state, "testing", review.usage);

	state.reviewSummary = outcome.summary;
	state.testingSummary = outcome.summary;
	state.bugs = retryBugs;
	await saveRunState(config.workspacePath, state);

	const reviewComment = buildReviewComment({
		issueKey: state.issue.key,
		passed: outcome.passed,
		summary: outcome.summary,
		usage: review.usage,
		bugs: retryBugs,
	});

	if (!config.dryRun && state.pullRequest) {
		await commentOnPr(config, state.pullRequest, reviewComment);
	}
	await linear.comment(state.issue.id, reviewComment);

	if (!outcome.passed) {
		Object.assign(state, transitionStage(state, "implementing"));
		await saveRunState(config.workspacePath, state);
		await linear.markStage(state.issue.id, "implementing");
		await linear.comment(
			state.issue.id,
			"Review/testing failed. Feedback was sent back to implementation for another pass.",
		);
		return;
	}

	Object.assign(state, transitionStage(state, "done"));
	await saveRunState(config.workspacePath, state);
	await linear.markStage(state.issue.id, "done");
	await linear.comment(state.issue.id, "Review/testing passed. Marked done.");
	await safeNotifyTaskOutcome(notifications, state, "done");
	logger.info(
		buildIssueJobLogFields(state, "testing"),
		"Review/testing completed",
	);
}

export function normalizeFailedReviewBugs(
	outcome: ReviewOutcome,
): RunState["bugs"] {
	if (outcome.passed) {
		return [];
	}
	if (outcome.bugs.length > 0) {
		return outcome.bugs;
	}
	const summary =
		outcome.summary.trim() ||
		"Review/testing failed but no structured BUGS_JSON details were provided.";
	return [
		{
			title: "Review/testing failed without structured bug details",
			body: summary,
		},
	];
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

export function fixedBugsForImplementationComment(
	hasExistingPr: boolean,
	bugs: RunState["bugs"],
): RunState["bugs"] {
	if (!hasExistingPr || bugs.length === 0) {
		return [];
	}
	return bugs.map((bug) => ({
		title: bug.title,
		body: bug.body,
		issueUrl: bug.issueUrl,
	}));
}

export interface PlannerDecision {
	complexity: "SIMPLE" | "COMPLEX";
	splitTasks: PlannedSplitTask[];
}

export function parsePlannerDecision(planSummary: string): PlannerDecision {
	const complexity = parsePlannerComplexity(planSummary);
	if (complexity === "SIMPLE") {
		return {
			complexity,
			splitTasks: [],
		};
	}
	return {
		complexity,
		splitTasks: parsePlannerSplitTasks(planSummary),
	};
}

export function parsePlannerComplexity(
	planSummary: string,
): "SIMPLE" | "COMPLEX" {
	const match = planSummary.match(
		/(?:^|\n)\s*COMPLEXITY\s*:\s*(SIMPLE|COMPLEX)\s*(?:\n|$)/i,
	);
	if (!match?.[1]) {
		return "SIMPLE";
	}
	return match[1].toUpperCase() === "COMPLEX" ? "COMPLEX" : "SIMPLE";
}

export function parsePlannerSplitTasks(
	planSummary: string,
): PlannedSplitTask[] {
	const marker = /\bSPLIT_TASKS_JSON\s*:/i;
	const markerMatch = marker.exec(planSummary);
	if (!markerMatch) {
		throw new Error(
			"Planner marked task as COMPLEX but omitted SPLIT_TASKS_JSON.",
		);
	}

	const markerStart = markerMatch.index + markerMatch[0].length;
	const rawPayload = planSummary.slice(markerStart).trim();
	if (!rawPayload) {
		throw new Error(
			"Planner marked task as COMPLEX but SPLIT_TASKS_JSON was empty.",
		);
	}

	const jsonSource = unwrapFencedCodeBlock(rawPayload);
	const jsonArrayText = extractFirstJsonArray(jsonSource);
	if (!jsonArrayText) {
		throw new Error(
			"Planner marked task as COMPLEX but SPLIT_TASKS_JSON did not contain a JSON array.",
		);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonArrayText);
	} catch (error) {
		throw new Error(
			`Failed to parse SPLIT_TASKS_JSON: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
	if (!Array.isArray(parsed) || parsed.length === 0) {
		throw new Error(
			"SPLIT_TASKS_JSON must be a non-empty JSON array when COMPLEXITY is COMPLEX.",
		);
	}

	return parsed.map((value, index) => validateSplitTask(value, index));
}

function validateSplitTask(value: unknown, index: number): PlannedSplitTask {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`Split task at index ${index} must be an object.`);
	}
	const record = value as Record<string, unknown>;
	const title =
		typeof record.title === "string" ? record.title.trim() : undefined;
	if (!title) {
		throw new Error(
			`Split task at index ${index} is missing a non-empty title.`,
		);
	}

	const description =
		typeof record.description === "string"
			? record.description.trim() || undefined
			: undefined;

	const labels = parseSplitTaskLabels(record.labels, index);
	const priority = parseSplitTaskPriority(record.priority, index);

	return {
		title,
		description,
		labels,
		priority,
	};
}

function parseSplitTaskLabels(
	rawLabels: unknown,
	index: number,
): string[] | undefined {
	if (rawLabels === undefined) {
		return undefined;
	}
	if (!Array.isArray(rawLabels)) {
		throw new Error(`Split task at index ${index} has non-array labels.`);
	}
	const labels = rawLabels
		.map((label, labelIndex) => {
			if (typeof label !== "string") {
				throw new Error(
					`Split task at index ${index} has non-string label at position ${labelIndex}.`,
				);
			}
			return label.trim();
		})
		.filter(Boolean);
	return labels.length > 0 ? labels : undefined;
}

function parseSplitTaskPriority(
	rawPriority: unknown,
	index: number,
): number | undefined {
	if (rawPriority === undefined) {
		return undefined;
	}
	if (
		typeof rawPriority !== "number" ||
		!Number.isInteger(rawPriority) ||
		rawPriority < 0 ||
		rawPriority > 4
	) {
		throw new Error(
			`Split task at index ${index} has invalid priority '${String(rawPriority)}'. Expected integer 0-4.`,
		);
	}
	return rawPriority;
}

function unwrapFencedCodeBlock(input: string): string {
	if (!input.startsWith("```")) {
		return input;
	}
	const firstNewline = input.indexOf("\n");
	if (firstNewline === -1) {
		return input;
	}
	const closingFence = input.indexOf("\n```", firstNewline + 1);
	if (closingFence === -1) {
		return input.slice(firstNewline + 1);
	}
	return input.slice(firstNewline + 1, closingFence).trim();
}

function extractFirstJsonArray(input: string): string | null {
	const start = input.indexOf("[");
	if (start === -1) {
		return null;
	}
	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let i = start; i < input.length; i += 1) {
		const char = input[i];
		if (!char) {
			continue;
		}
		if (inString) {
			if (escaped) {
				escaped = false;
				continue;
			}
			if (char === "\\") {
				escaped = true;
				continue;
			}
			if (char === '"') {
				inString = false;
			}
			continue;
		}
		if (char === '"') {
			inString = true;
			continue;
		}
		if (char === "[") {
			depth += 1;
			continue;
		}
		if (char === "]") {
			depth -= 1;
			if (depth === 0) {
				return input.slice(start, i + 1);
			}
		}
	}
	return null;
}

export function buildRunLeaseOwnerId(nowMs = Date.now()): string {
	return `${process.pid}-${nowMs}-${Math.floor(Math.random() * 100000)}`;
}

async function tryAcquireRunLease(
	cwd: string,
	state: RunState,
	leaseOwnerId: string,
	leaseTimeoutMs: number,
): Promise<boolean> {
	const nowMs = Date.now();
	if (hasRunLeaseConflict(state, leaseOwnerId, nowMs)) {
		return false;
	}
	Object.assign(
		state,
		applyRunLease(state, leaseOwnerId, leaseTimeoutMs, nowMs),
	);
	await saveRunState(cwd, state);
	return true;
}

async function heartbeatRunLease(
	cwd: string,
	state: RunState,
	leaseOwnerId: string,
	leaseTimeoutMs: number,
): Promise<void> {
	const nowMs = Date.now();
	if (hasRunLeaseConflict(state, leaseOwnerId, nowMs)) {
		throw new Error(
			"Run lease is no longer owned by the active worker; stopping issue execution.",
		);
	}
	Object.assign(
		state,
		applyRunLease(state, leaseOwnerId, leaseTimeoutMs, nowMs),
	);
	await saveRunState(cwd, state);
}

async function releaseRunLease(
	cwd: string,
	state: RunState,
	leaseOwnerId: string,
): Promise<void> {
	if (!state.lease?.ownerId || state.lease.ownerId !== leaseOwnerId) {
		return;
	}
	Object.assign(state, clearRunLease(state));
	await saveRunState(cwd, state);
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

async function safeNotifyTaskOutcome(
	notifications: ResolvedNotificationConfig,
	state: RunState,
	outcome: "done" | "blocked",
	errorMessage?: string,
): Promise<void> {
	const runLogger = logger.child({
		projectId: state.projectId,
		issueKey: state.issue.key,
		outcome,
	});
	try {
		await sendTaskOutcomeEmail(
			notifications.email,
			state,
			outcome,
			errorMessage,
		);
	} catch (error) {
		runLogger.error(
			{ err: normalizeError(error) },
			"Failed to send task outcome email notification",
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
