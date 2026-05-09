import {
	type AgentAdapter,
	type AgentResult,
	createAgentAdapter,
} from "../agent-adapters";
import {
	commentOnPr,
	createDraftPrFromWorktree,
	findOpenPullRequestForIssue,
	issueBranchName,
	markPrReadyForReview,
	prepareImplementationBranch,
	squashMergePullRequest,
	updateDraftPrFromWorktree,
} from "../services/github";
import { LinearClient, sortIssuesByPriority } from "../services/linear";
import {
	sendHumanReviewRequiredEmail,
	sendTaskOutcomeEmail,
} from "../services/notifications";
import { selectPlanningSupplementalSkills } from "../skills/catalog";
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
import { type LoadedConfig, getProjectById } from "./config";
import { type ReviewOutcome, parseReviewOutcome } from "./review";
import {
	appendAgentChatLog,
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
	AgentChatLogEntry,
	AgentChatLogRole,
	CodexUsageRecord,
	IssueRef,
	PlannedSplitTask,
	PollingConfig,
	PullRequestRef,
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
	description?: string;
	url: string;
	teamId?: string;
	priority: {
		value: number;
		name: string;
	};
	labels: Array<{
		id: string;
		name: string;
	}>;
	state: {
		id: string;
		name: string;
	};
	pullRequest?: PullRequestRef;
}

const DEFAULT_PLANNER_COMPLEXITY_SCORE = 4;
const HUMAN_REVIEW_COMPLEXITY_THRESHOLD = 5;
const executionPathLockTails = new Map<string, Promise<void>>();

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

	if (options.reviewOnly) {
		await Promise.all(
			issueQueue.map((issue) =>
				processIssue(
					config,
					notifications,
					linear,
					issue,
					options,
					polling.staleRunTimeoutMs,
					buildRunLeaseOwnerId(),
				),
			),
		);
		return issueQueue.length;
	}

	for (const issue of issueQueue) {
		await processIssue(
			config,
			notifications,
			linear,
			issue,
			options,
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
	if (options.reviewOnly) {
		const runStates = await listRunStates(config.workspacePath, config.id);
		const reviewOnlyIssues = await fetchReviewOnlyIssues(
			config,
			linear,
			runStates,
		);
		return {
			issueQueue: sortIssuesByPriority(reviewOnlyIssues),
			staleRetryCount: 0,
		};
	}

	const assignedIssues = await linear.fetchWork(options.issueArg);
	if (options.issueArg !== undefined) {
		return {
			issueQueue: selectIssueQueueForCycle(
				options.issueArg,
				assignedIssues,
				[],
				options,
			),
			staleRetryCount: 0,
		};
	}
	const staleRetryIssues = await fetchStaleIssuesForRetry(
		config,
		linear,
		polling.staleRunTimeoutMs,
		assignedIssues,
	);
	return {
		issueQueue: selectIssueQueueForCycle(
			options.issueArg,
			assignedIssues,
			staleRetryIssues,
			options,
		),
		staleRetryCount: staleRetryIssues.length,
	};
}

export function buildPrioritizedIssueQueue(
	assignedIssues: WorkflowIssue[],
	staleRetryIssues: WorkflowIssue[],
): WorkflowIssue[] {
	return sortIssuesByPriority(
		dedupeIssuesByKey([...assignedIssues, ...staleRetryIssues]),
	);
}

export function selectIssueQueueForCycle(
	issueArg: string | undefined,
	assignedIssues: WorkflowIssue[],
	staleRetryIssues: WorkflowIssue[],
	options: Pick<RunOptions, "reviewOnly"> = {},
): WorkflowIssue[] {
	if (options.reviewOnly) {
		return [];
	}
	if (issueArg !== undefined) {
		return assignedIssues;
	}
	return buildPrioritizedIssueQueue(assignedIssues, staleRetryIssues);
}

export function isReviewOnlyEligibleRunState(state: RunState): boolean {
	return (
		(state.stage === "pr_created" ||
			state.stage === "reviewing" ||
			state.stage === "testing" ||
			(state.stage === "done" &&
				!state.pullRequestApprovedAt &&
				!state.humanReviewNotifiedAt)) &&
		Boolean(state.pullRequest?.url)
	);
}

export function resolveReviewOnlyBootstrapStage(
	state: WorkflowIssue["state"],
	statusMap: ResolvedProjectConfig["linear"]["statusMap"],
): WorkflowStage {
	if (matchesIssueStateConfigValue(state, statusMap.pr_created)) {
		return "pr_created";
	}
	if (matchesIssueStateConfigValue(state, statusMap.reviewing)) {
		return "reviewing";
	}
	if (matchesIssueStateConfigValue(state, statusMap.done)) {
		return "done";
	}
	return "testing";
}

export interface ReviewOnlyQueueBuildResult {
	issueQueue: WorkflowIssue[];
	mergedCandidateCount: number;
	discoveredPrCount: number;
	skippedWithoutPr: number;
}

export function buildReviewOnlyIssueQueue(input: {
	runStates: RunState[];
	localIssues: WorkflowIssue[];
	linearIssues: WorkflowIssue[];
	discoveredPullRequestsByIssueKey: Map<string, PullRequestRef | undefined>;
}): ReviewOnlyQueueBuildResult {
	const merged = dedupeIssuesByKey([
		...input.localIssues,
		...input.linearIssues,
	]);
	const runStateByKey = new Map(
		input.runStates.map((state) => [normalizeIssueKey(state.issue.key), state]),
	);
	const issueQueue: WorkflowIssue[] = [];
	let discoveredPrCount = 0;
	let skippedWithoutPr = 0;

	for (const issue of merged) {
		const key = normalizeIssueKey(issue.identifier);
		const runState = runStateByKey.get(key);
		if (runState?.stage === "done" && !isReviewOnlyEligibleRunState(runState)) {
			continue;
		}
		const runStatePr = runState?.pullRequest;
		const discoveredPr = input.discoveredPullRequestsByIssueKey.get(key);
		const pullRequest = runStatePr?.url ? runStatePr : discoveredPr;

		if (!runStatePr?.url && discoveredPr?.url) {
			discoveredPrCount += 1;
		}
		if (!pullRequest?.url) {
			skippedWithoutPr += 1;
			continue;
		}

		issueQueue.push({
			...issue,
			pullRequest,
		});
	}

	return {
		issueQueue,
		mergedCandidateCount: merged.length,
		discoveredPrCount,
		skippedWithoutPr,
	};
}

export function selectReviewOnlyIssueKeys(runStates: RunState[]): string[] {
	return runStates
		.filter((state) => isReviewOnlyEligibleRunState(state))
		.map((state) => normalizeIssueKey(state.issue.key));
}

export function isReviewOnlyExecutableStage(stage: WorkflowStage): boolean {
	return (
		stage === "pr_created" ||
		stage === "reviewing" ||
		stage === "testing" ||
		stage === "done"
	);
}

export function shouldSkipReviewOnlyRunState(
	state: Pick<RunState, "stage"> | null,
	options: Pick<RunOptions, "reviewOnly">,
): boolean {
	return options.reviewOnly === true && state?.stage === "human_review";
}

export function resolveReviewFailureStage(
	state: Pick<RunState, "codexSessionId">,
): Extract<WorkflowStage, "implementing" | "human_review"> {
	return state.codexSessionId ? "implementing" : "human_review";
}

export async function withExecutionPathLock<T>(
	executionPath: string,
	run: () => Promise<T>,
): Promise<T> {
	const currentTail = executionPathLockTails.get(executionPath);
	const previousTail = currentTail
		? currentTail.catch(() => undefined)
		: undefined;

	let release!: () => void;
	const nextTail = new Promise<void>((resolve) => {
		release = resolve;
	});
	const queuedTail = previousTail
		? previousTail.then(() => nextTail)
		: nextTail;
	executionPathLockTails.set(executionPath, queuedTail);

	if (previousTail) {
		await previousTail;
	}

	try {
		return await run();
	} finally {
		release();
		if (executionPathLockTails.get(executionPath) === queuedTail) {
			executionPathLockTails.delete(executionPath);
		}
	}
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
			priority: issue.priority,
			labels: issue.labels,
			state: issue.state,
		});
	}
	return staleIssues;
}

async function fetchReviewOnlyIssues(
	config: ResolvedProjectConfig,
	linear: LinearClient,
	runStates: RunState[],
): Promise<WorkflowIssue[]> {
	const issueKeys = selectReviewOnlyIssueKeys(runStates);
	const localIssues: WorkflowIssue[] = [];
	for (const key of issueKeys) {
		const issue = await linear.fetchIssueByIdentifier(key);
		if (!issue) {
			continue;
		}
		localIssues.push({
			id: issue.id,
			identifier: issue.identifier,
			title: issue.title,
			url: issue.url,
			teamId: issue.teamId,
			priority: issue.priority,
			labels: issue.labels,
			state: issue.state,
		});
	}

	const linearIssues = await linear.fetchReviewOnlyWork();
	const discoveredPullRequestsByIssueKey = new Map<
		string,
		PullRequestRef | undefined
	>();
	for (const issue of dedupeIssuesByKey([...localIssues, ...linearIssues])) {
		const key = normalizeIssueKey(issue.identifier);
		const hasRunStatePr = runStates.some(
			(state) =>
				normalizeIssueKey(state.issue.key) === key &&
				Boolean(state.pullRequest?.url),
		);
		if (hasRunStatePr) {
			continue;
		}
		try {
			discoveredPullRequestsByIssueKey.set(
				key,
				await findOpenPullRequestForIssue(config, key),
			);
		} catch (error) {
			discoveredPullRequestsByIssueKey.set(key, undefined);
			logger.warn(
				{
					projectId: config.id,
					issueKey: key,
					err: normalizeError(error),
				},
				"Failed to discover PR for review-only issue",
			);
		}
	}
	const built = buildReviewOnlyIssueQueue({
		runStates,
		localIssues,
		linearIssues,
		discoveredPullRequestsByIssueKey,
	});

	logger.info(
		{
			projectId: config.id,
			localReviewCandidates: localIssues.length,
			linearReviewCandidates: linearIssues.length,
			mergedReviewCandidates: built.mergedCandidateCount,
			discoveredPrCount: built.discoveredPrCount,
			skippedWithoutPr: built.skippedWithoutPr,
			queuedReviewCandidates: built.issueQueue.length,
		},
		"Built review-only candidate queue",
	);

	return built.issueQueue;
}

async function processIssue(
	config: ResolvedProjectConfig,
	notifications: ResolvedNotificationConfig,
	linear: LinearClient,
	issue: WorkflowIssue,
	options: RunOptions,
	leaseTimeoutMs: number,
	leaseOwnerId: string,
): Promise<void> {
	const key = normalizeIssueKey(issue.identifier);
	const issueLogger = logger.child({ projectId: config.id, issueKey: key });
	const existing = await loadRunState(config.workspacePath, config.id, key);
	if (shouldSkipReviewOnlyRunState(existing, options)) {
		issueLogger.info(
			{ stage: existing?.stage },
			"Skipping review-only issue parked for manual review",
		);
		return;
	}
	const isAssignedState = await linear.isAssignedState(issue.state.id);
	if (!existing && !isAssignedState && !options.reviewOnly) {
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
				description: issue.description,
				url: issue.url,
				teamId: issue.teamId,
			},
			stage: options.reviewOnly
				? resolveReviewOnlyBootstrapStage(issue.state, config.linear.statusMap)
				: "received",
			reviewMode: options.reviewOnly ? "bot" : undefined,
			pullRequest: issue.pullRequest,
			bugs: [],
			startedAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		} satisfies RunState);

	if (
		options.reviewOnly &&
		issue.pullRequest?.url &&
		!runState.pullRequest?.url
	) {
		runState.pullRequest = issue.pullRequest;
	}
	if (
		options.reviewOnly &&
		runState.stage !== "human_review" &&
		!isReviewOnlyExecutableStage(runState.stage)
	) {
		runState.stage = resolveReviewOnlyBootstrapStage(
			issue.state,
			config.linear.statusMap,
		);
	}
	if (options.reviewOnly && !runState.reviewMode) {
		runState.reviewMode = "bot";
	}
	issueLogger.info(
		buildIssueJobLogFields(runState, runState.stage, {
			resumed: existing !== null,
		}),
		"Taking issue job",
	);

	let leaseAcquired = false;
	try {
		await withExecutionPathLock(config.executionPath, async () => {
			leaseAcquired = await tryAcquireRunLease(
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
			await executeIssue(
				config,
				notifications,
				linear,
				runState,
				options,
				leaseOwnerId,
				leaseTimeoutMs,
			);
		});
		if (!leaseAcquired) {
			return;
		}
		issueLogger.info({ stage: runState.stage }, "Issue workflow finished");
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		runState.lastError = message;
		if (runState.stage === "done") {
			await saveRunState(config.workspacePath, runState);
			issueLogger.error(
				{
					err: normalizeError(error),
					stage: runState.stage,
				},
				"Issue workflow failed after reaching done",
			);
			return;
		}
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
		if (leaseAcquired) {
			await releaseRunLease(config.workspacePath, runState, leaseOwnerId);
		}
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

function matchesIssueStateConfigValue(
	state: WorkflowIssue["state"],
	configValue: string,
): boolean {
	const expected = configValue.trim().toLowerCase();
	return (
		state.id.toLowerCase() === expected || state.name.toLowerCase() === expected
	);
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
	options: RunOptions,
	leaseOwnerId: string,
	leaseTimeoutMs: number,
): Promise<void> {
	const agent = createAgentAdapter(config);

	if (options.reviewOnly && state.stage === "done") {
		await handleDoneReviewMergeStage(config, notifications, linear, state);
		return;
	}

	while (
		state.stage !== "done" &&
		state.stage !== "blocked" &&
		state.stage !== "human_review"
	) {
		if (options.reviewOnly && !isReviewOnlyExecutableStage(state.stage)) {
			break;
		}
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
			await handlePrCreatedStage(config, notifications, linear, state);
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
	const supplemental = await selectPlanningSupplementalSkills(
		config,
		state.issue,
	);
	const prompt = await buildPlanPrompt(config.skills.plan, state.issue, {
		supplementalSkills: supplemental.selected,
		autoSelectWarnings: supplemental.warnings,
	});
	const result = await runAgentWithChatLog({
		workspacePath: config.workspacePath,
		projectId: config.id,
		issue: state.issue,
		agentRole: "planning",
		skillPath: config.skills.plan,
		prompt,
		invoke: () => agent.runPlan(prompt),
	});
	state.codexSessionId = result.sessionId ?? state.codexSessionId;
	state.planSummary = result.finalMessage || result.stdout;
	appendCodexUsage(state, "planning", result.usage);
	await applyPlannerIssueRefinement(linear, state.issue, state.planSummary);

	const parsedPlan = parsePlannerDecision(state.planSummary);
	state.complexityScore = parsedPlan.complexityScore;
	state.reviewMode = resolveReviewModeForComplexityScore(
		parsedPlan.complexityScore,
	);
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
	await linear.clearWorkflowStageLabels(state.issue.id);
	await linear.comment(
		state.issue.id,
		buildPlanSplitComment(state.issue.key, state.planSummary, createdTasks, {
			usage: result.usage,
		}),
	);
	await safeNotifyTaskOutcome(notifications, state, "done");
	logger.info(buildIssueJobLogFields(state, "planning"), "Plan completed");
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
async function handleImplementingStage(
	config: ResolvedProjectConfig,
	agent: AgentAdapter,
	linear: LinearClient,
	state: RunState,
): Promise<void> {
	if (!state.codexSessionId) {
		throw new Error("Missing codex session id for implement step");
	}
	const codexSessionId = state.codexSessionId;
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
	const result = await runAgentWithChatLog({
		workspacePath: config.workspacePath,
		projectId: config.id,
		issue: state.issue,
		agentRole: "implementing",
		skillPath: config.skills.implement,
		prompt,
		invoke: () => agent.resume(codexSessionId, prompt),
	});
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
	notifications: ResolvedNotificationConfig,
	linear: LinearClient,
	state: RunState,
): Promise<void> {
	Object.assign(state, transitionStage(state, "reviewing"));
	await saveRunState(config.workspacePath, state);
	await linear.markStage(state.issue.id, "reviewing");
	await linear.applyStageLabel(state.issue.id, "reviewing");
}

export async function handleReviewTestingStage(
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
	const review = await runAgentWithChatLog({
		workspacePath: config.workspacePath,
		projectId: config.id,
		issue: state.issue,
		agentRole: "review-testing",
		skillPath: config.skills.reviewTest,
		prompt,
		invoke: () => agent.runReview(prompt),
	});
	const outcome = parseReviewOutcome(review.finalMessage || review.stdout);
	const retryBugs = normalizeFailedReviewBugs(outcome);
	appendCodexUsage(state, "testing", review.usage);
	state.reviewSessionId = review.sessionId;

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
		await safePrComment(config, state, reviewComment);
	}
	await linear.comment(state.issue.id, reviewComment);

	if (!outcome.passed) {
		const nextStage = resolveReviewFailureStage(state);
		Object.assign(state, transitionStage(state, nextStage));
		await saveRunState(config.workspacePath, state);
		if (nextStage === "implementing") {
			await linear.markStage(state.issue.id, nextStage);
		} else {
			await linear.markStage(state.issue.id, "reviewing");
		}
		if (nextStage === "implementing") {
			await linear.comment(
				state.issue.id,
				"Review/testing failed. Feedback was sent back to implementation for another pass.",
			);
		} else {
			await linear.applyStageLabel(state.issue.id, "reviewing");
			await linear.comment(
				state.issue.id,
				"Review/testing failed, but no resumable implementation session is available. Parked for manual review and PR updates.",
			);
		}
		return;
	}

	await readyPullRequestAfterPassingReview(config, state.pullRequest, true);
	Object.assign(state, transitionStage(state, "done"));
	await saveRunState(config.workspacePath, state);
	await linear.markStage(state.issue.id, "reviewing");
	await linear.applyStageLabel(state.issue.id, "reviewing");
	await linear.comment(
		state.issue.id,
		"Review/testing passed. PR is ready and issue remains in review until merge.",
	);
	logger.info(
		buildIssueJobLogFields(state, "testing"),
		"Review/testing completed",
	);
}

async function handleDoneReviewMergeStage(
	config: ResolvedProjectConfig,
	notifications: ResolvedNotificationConfig,
	linear: LinearClient,
	state: RunState,
): Promise<void> {
	if (state.pullRequestApprovedAt) {
		return;
	}

	const score = state.complexityScore ?? DEFAULT_PLANNER_COMPLEXITY_SCORE;
	if (!shouldSquashMergePullRequestForComplexityScore(score)) {
		const reason = `Planning complexity score ${score}/10 requires human PR approval (threshold >= ${HUMAN_REVIEW_COMPLEXITY_THRESHOLD}).`;
		if (!state.humanReviewNotifiedAt) {
			await linear.comment(
				state.issue.id,
				[
					`Human PR approval required for ${state.issue.key}.`,
					reason,
					state.pullRequest?.url ? `PR: ${state.pullRequest.url}` : undefined,
				]
					.filter(Boolean)
					.join("\n"),
			);
			await safeNotifyHumanReviewRequired(notifications, state, score, reason);
			state.humanReviewNotifiedAt = new Date().toISOString();
			await saveRunState(config.workspacePath, state);
		}
		return;
	}

	const merged = await safeSquashMergePullRequest(config, state);
	if (!merged) {
		return;
	}

	await finalizeIssueAfterReviewMerge(config, notifications, linear, state);
}

export async function finalizeIssueAfterReviewMerge(
	config: ResolvedProjectConfig,
	notifications: ResolvedNotificationConfig,
	linear: LinearClient,
	state: RunState,
): Promise<void> {
	await linear.markStage(state.issue.id, "done");
	await linear.clearWorkflowStageLabels(state.issue.id);
	await linear.comment(
		state.issue.id,
		"PR squash-merged after completed review.",
	);
	state.pullRequestApprovedAt = new Date().toISOString();
	await saveRunState(config.workspacePath, state);
	await safeNotifyTaskOutcome(notifications, state, "done");
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

export interface RunAgentWithChatLogOptions {
	workspacePath: string;
	projectId: string;
	issue: RunState["issue"];
	agentRole: AgentChatLogRole;
	skillPath: string;
	prompt: string;
	invoke: () => Promise<AgentResult>;
}

export async function runAgentWithChatLog(
	options: RunAgentWithChatLogOptions,
): Promise<AgentResult> {
	try {
		const result = await options.invoke();
		await persistAgentChatLog(options, {
			finalMessage: result.finalMessage,
			stdout: result.stdout,
			sessionId: result.sessionId,
			usage: result.usage,
			success: true,
		});
		return result;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		await persistAgentChatLog(options, {
			finalMessage: "",
			stdout: "",
			success: false,
			error: message,
		});
		throw error;
	}
}

interface PersistedAgentChatLogResult {
	finalMessage: string;
	stdout: string;
	sessionId?: string;
	usage?: AgentResult["usage"];
	success: boolean;
	error?: string;
}

async function persistAgentChatLog(
	options: RunAgentWithChatLogOptions,
	result: PersistedAgentChatLogResult,
): Promise<void> {
	const entry: AgentChatLogEntry = {
		projectId: options.projectId,
		issueKey: options.issue.key,
		issueId: options.issue.id,
		issueTitle: options.issue.title,
		agentRole: options.agentRole,
		skillPath: options.skillPath,
		prompt: options.prompt,
		finalMessage: result.finalMessage,
		stdout: result.stdout,
		sessionId: result.sessionId,
		usage: result.usage,
		success: result.success,
		error: result.error,
		recordedAt: new Date().toISOString(),
	};
	try {
		await appendAgentChatLog(options.workspacePath, options.projectId, entry);
	} catch (error) {
		logger.error(
			{
				projectId: options.projectId,
				issueKey: options.issue.key,
				agentRole: options.agentRole,
				skillPath: options.skillPath,
				err: normalizeError(error),
			},
			"Failed to append agent chat log entry",
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

export async function readyPullRequestAfterPassingReview(
	config: ResolvedProjectConfig,
	pullRequest: RunState["pullRequest"],
	passed: boolean,
	deps?: {
		markPrReadyForReview?: typeof markPrReadyForReview;
	},
): Promise<boolean> {
	if (!passed || config.dryRun || !pullRequest) {
		return false;
	}
	const markReady = deps?.markPrReadyForReview ?? markPrReadyForReview;
	return markReady(config, pullRequest);
}

export interface PlannerDecision {
	complexity: "SIMPLE" | "COMPLEX";
	splitTasks: PlannedSplitTask[];
	complexityScore: number;
}

export interface PlannerIssueRefinement {
	title: string;
	description: string;
}

export function parsePlannerDecision(planSummary: string): PlannerDecision {
	const complexity = parsePlannerComplexity(planSummary);
	const complexityScore = parsePlannerComplexityScore(planSummary);
	if (complexity === "SIMPLE") {
		return {
			complexity,
			splitTasks: [],
			complexityScore,
		};
	}
	return {
		complexity,
		splitTasks: parsePlannerSplitTasks(planSummary),
		complexityScore,
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

export function parsePlannerComplexityScore(planSummary: string): number {
	const match = planSummary.match(
		/(?:^|\n)\s*COMPLEXITY_SCORE\s*:\s*([^\n]+)\s*(?:\n|$)/i,
	);
	if (!match?.[1]) {
		return DEFAULT_PLANNER_COMPLEXITY_SCORE;
	}

	const rawScore = match[1].trim();
	if (!/^\d+$/.test(rawScore)) {
		throw new Error(
			`Invalid COMPLEXITY_SCORE '${rawScore}'. Expected an integer between 0 and 10.`,
		);
	}

	const score = Number(rawScore);
	if (!Number.isInteger(score) || score < 0 || score > 10) {
		throw new Error(
			`Invalid COMPLEXITY_SCORE '${rawScore}'. Expected an integer between 0 and 10.`,
		);
	}
	return score;
}

export function parsePlannerIssueRefinement(
	planSummary: string,
): PlannerIssueRefinement | null {
	const marker = /\bISSUE_REFINEMENT_JSON\s*:/i;
	const markerMatch = marker.exec(planSummary);
	if (!markerMatch) {
		return null;
	}

	const markerStart = markerMatch.index + markerMatch[0].length;
	const rawPayload = planSummary.slice(markerStart).trim();
	if (!rawPayload) {
		throw new Error(
			"Planner included ISSUE_REFINEMENT_JSON marker but no JSON payload.",
		);
	}

	const jsonSource = unwrapFencedCodeBlock(rawPayload);
	const jsonObjectText = extractFirstJsonObject(jsonSource);
	if (!jsonObjectText) {
		throw new Error(
			"ISSUE_REFINEMENT_JSON must contain a JSON object with title and description.",
		);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonObjectText);
	} catch (error) {
		throw new Error(
			`Failed to parse ISSUE_REFINEMENT_JSON: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error("ISSUE_REFINEMENT_JSON must be a JSON object.");
	}

	const record = parsed as Record<string, unknown>;
	const title =
		typeof record.title === "string" ? record.title.trim() : undefined;
	const description =
		typeof record.description === "string"
			? record.description.trim()
			: undefined;
	if (!title) {
		throw new Error("ISSUE_REFINEMENT_JSON.title must be a non-empty string.");
	}
	if (!description) {
		throw new Error(
			"ISSUE_REFINEMENT_JSON.description must be a non-empty string.",
		);
	}

	return { title, description };
}

export async function applyPlannerIssueRefinement(
	linear: Pick<LinearClient, "updateIssueDetails">,
	issue: IssueRef,
	planSummary: string,
): Promise<boolean> {
	const refinement = parsePlannerIssueRefinement(planSummary);
	if (!refinement) {
		return false;
	}

	const currentDescription = issue.description?.trim() ?? "";
	if (
		issue.title.trim() === refinement.title &&
		currentDescription === refinement.description
	) {
		return false;
	}

	await linear.updateIssueDetails(
		issue.id,
		refinement.title,
		refinement.description,
	);
	issue.title = refinement.title;
	issue.description = refinement.description;
	return true;
}

export function resolveReviewModeForComplexityScore(
	complexityScore: number,
): "bot" | "human" {
	return complexityScore < HUMAN_REVIEW_COMPLEXITY_THRESHOLD ? "bot" : "human";
}

export function shouldSquashMergePullRequestForComplexityScore(
	complexityScore: number,
): boolean {
	return complexityScore < HUMAN_REVIEW_COMPLEXITY_THRESHOLD;
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

function extractFirstJsonObject(input: string): string | null {
	const start = input.indexOf("{");
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
		if (char === "{") {
			depth += 1;
			continue;
		}
		if (char === "}") {
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

async function safePrComment(
	config: ResolvedProjectConfig,
	state: RunState,
	body: string,
): Promise<void> {
	if (!state.pullRequest) {
		return;
	}
	const runLogger = logger.child({
		projectId: state.projectId,
		issueKey: state.issue.key,
		pr: state.pullRequest.url ?? state.pullRequest.number,
	});
	try {
		runLogger.info(
			{
				commentBody: body,
				runState: state,
			},
			"Adding GitHub PR comment",
		);
		await commentOnPr(config, state.pullRequest, body);
	} catch (error) {
		runLogger.error(
			{ err: normalizeError(error) },
			"Failed to add GitHub PR comment",
		);
	}
}

async function safeSquashMergePullRequest(
	config: ResolvedProjectConfig,
	state: RunState,
): Promise<boolean> {
	if (!state.pullRequest) {
		return false;
	}
	const runLogger = logger.child({
		projectId: state.projectId,
		issueKey: state.issue.key,
		pr: state.pullRequest.url ?? state.pullRequest.number,
	});
	try {
		return await squashMergePullRequest(config, state.pullRequest);
	} catch (error) {
		runLogger.error(
			{ err: normalizeError(error) },
			"Failed to squash-merge GitHub PR",
		);
		return false;
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

async function safeNotifyHumanReviewRequired(
	notifications: ResolvedNotificationConfig,
	state: RunState,
	complexityScore: number,
	reason: string,
): Promise<void> {
	const runLogger = logger.child({
		projectId: state.projectId,
		issueKey: state.issue.key,
		outcome: "human_review_required",
	});
	try {
		await sendHumanReviewRequiredEmail(notifications.email, state, {
			complexityScore,
			reason,
		});
	} catch (error) {
		runLogger.error(
			{ err: normalizeError(error) },
			"Failed to send human review required email notification",
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
