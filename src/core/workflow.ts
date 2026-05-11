import type { AgentAdapter } from "../agent-adapters";
import { issueBranchName } from "../services/github";
import { sortIssuesByPriority } from "../services/linear";
import { buildFixPrompt, buildImplementPrompt } from "../skills/prompts";
import { buildImplementationComment } from "../utils/comments";
import { logger, normalizeError } from "../utils/logger";
import { runAgentWithChatLog } from "./agent-chat-log";
import { type LoadedConfig, getProjectById } from "./config";
import {
	handlePlanningStage,
	shouldSquashMergePullRequestForComplexityScore,
} from "./plan";
import {
	finalizeIssueAfterReviewMerge as finalizeIssueAfterReviewMergeInternal,
	handleReviewTestingStage as handleReviewTestingStageInternal,
	readyPullRequestAfterPassingReview,
} from "./review-stage";
import {
	appendProjectErrorLog,
	isRunLeaseExpired,
	listRunStates,
	loadRunState,
	normalizeIssueKey,
	projectErrorLogPath,
	saveRunState,
	transitionStage,
} from "./state";
import {
	buildRunLeaseOwnerId,
	heartbeatRunLease,
	releaseRunLease,
	tryAcquireRunLease,
} from "./workflow-lease";
import {
	buildPrioritizedIssueQueue as buildPrioritizedIssueQueueHelper,
	dedupeIssuesByKey,
} from "./workflow-queue";
import {
	type WorkflowLinearClient,
	type WorkflowRuntime,
	createWorkflowRuntime,
} from "./workflow-runtime";
import type {
	IssueJobLogFields,
	IssueProjectRoutingResult,
	PollingSettings,
	ReviewOnlyQueueBuildResult,
	WorkflowIssue,
} from "./workflow.types";

export { buildRunLeaseOwnerId } from "./workflow-lease";
import type {
	CodexUsageRecord,
	PollingConfig,
	PullRequestRef,
	ResolvedNotificationConfig,
	ResolvedProjectConfig,
	RunOptions,
	RunState,
	WorkflowStage,
} from "./types";
export type {
	IssueJobLogFields,
	IssueProjectRoutingResult,
	PollingSettings,
	ReviewOnlyQueueBuildResult,
	WorkflowIssue,
} from "./workflow.types";

export { runAgentWithChatLog } from "./agent-chat-log";

const DEFAULT_PLANNER_COMPLEXITY_SCORE = 4;
const HUMAN_REVIEW_COMPLEXITY_THRESHOLD = 5;
const executionPathLockTails = new Map<string, Promise<void>>();

export async function runWorkflow(
	config: LoadedConfig,
	options: RunOptions,
	runtime: WorkflowRuntime = createWorkflowRuntime(),
): Promise<void> {
	const projects = pickProjects(config, options);
	if (projects.length === 0) {
		logger.info("No project selected.");
		return;
	}

	let projectContexts = projects.map((project) => ({
		config: project,
		linear: runtime.createLinearClient(project),
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
					runtime,
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
	contexts: Array<{
		config: ResolvedProjectConfig;
		linear: WorkflowLinearClient;
	}>,
	issueArg: string,
): Promise<
	Array<{ config: ResolvedProjectConfig; linear: WorkflowLinearClient }>
> {
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
	linear: WorkflowLinearClient,
	cycle: number,
	polling: PollingSettings,
	runtime: WorkflowRuntime,
): Promise<number> {
	const projectLogger = logger.child({ projectId: config.id });
	const { issueQueue, staleRetryCount } = await buildIssueQueueForProjectCycle(
		config,
		options,
		linear,
		polling,
		runtime,
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
					runtime,
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
			runtime,
		);
	}

	return issueQueue.length;
}

async function buildIssueQueueForProjectCycle(
	config: ResolvedProjectConfig,
	options: RunOptions,
	linear: WorkflowLinearClient,
	polling: PollingSettings,
	runtime: WorkflowRuntime,
): Promise<{ issueQueue: WorkflowIssue[]; staleRetryCount: number }> {
	if (options.reviewOnly) {
		const runStates = await listRunStates(config.workspacePath, config.id);
		const reviewOnlyIssues = await fetchReviewOnlyIssues(
			config,
			linear,
			runStates,
			runtime,
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
		buildPrioritizedIssueQueueHelper(assignedIssues, staleRetryIssues),
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

async function fetchStaleIssuesForRetry(
	config: ResolvedProjectConfig,
	linear: WorkflowLinearClient,
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
			projectId: issue.projectId,
			teamId: issue.teamId,
			creatorId: issue.creatorId,
			assigneeId: issue.assigneeId,
			priority: issue.priority,
			labels: issue.labels,
			state: issue.state,
		});
	}
	return staleIssues;
}

async function fetchReviewOnlyIssues(
	config: ResolvedProjectConfig,
	linear: WorkflowLinearClient,
	runStates: RunState[],
	runtime: WorkflowRuntime,
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
			projectId: issue.projectId,
			teamId: issue.teamId,
			creatorId: issue.creatorId,
			assigneeId: issue.assigneeId,
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
				await runtime.findOpenPullRequestForIssue(config, key),
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
	linear: WorkflowLinearClient,
	issue: WorkflowIssue,
	options: RunOptions,
	leaseTimeoutMs: number,
	leaseOwnerId: string,
	runtime: WorkflowRuntime,
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
				projectId: issue.projectId,
				teamId: issue.teamId,
				creatorId: issue.creatorId,
				assigneeId: issue.assigneeId,
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
				runtime,
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
		await safeNotifyTaskOutcome(
			notifications,
			runState,
			"blocked",
			message,
			runtime,
		);
	} finally {
		if (leaseAcquired) {
			await releaseRunLease(config.workspacePath, runState, leaseOwnerId);
		}
	}
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
	linear: WorkflowLinearClient,
	state: RunState,
	options: RunOptions,
	leaseOwnerId: string,
	leaseTimeoutMs: number,
	runtime: WorkflowRuntime,
): Promise<void> {
	if (options.reviewOnly && state.stage === "done") {
		await handleDoneReviewMergeStage(
			config,
			notifications,
			linear,
			state,
			runtime,
		);
		return;
	}

	await runtime.ensureBaseBranchFresh(config);
	const agent = runtime.createAgentAdapter(config);

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
			await handlePlanningStage(config, agent, notifications, linear, state, {
				runAgentWithChatLog,
				appendCodexUsage,
				saveRunState,
				transitionStage,
				safeNotifyTaskOutcome: (notifyConfig, runState, outcome, error) =>
					safeNotifyTaskOutcome(
						notifyConfig,
						runState,
						outcome,
						error,
						runtime,
					),
				loggerInfo: logger.info.bind(logger),
				buildIssueJobLogFields: (runState, stage, stageOptions) => ({
					...buildIssueJobLogFields(runState, stage, stageOptions),
				}),
			});
			continue;
		}

		if (state.stage === "implementing") {
			await handleImplementingStage(config, agent, linear, state, runtime);
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
				runtime,
			);
			continue;
		}

		throw new Error(`Unsupported workflow stage: ${state.stage}`);
	}
}

export async function handleReviewTestingStage(
	config: ResolvedProjectConfig,
	agent: AgentAdapter,
	_notifications: ResolvedNotificationConfig,
	linear: WorkflowLinearClient,
	state: RunState,
	runtime: WorkflowRuntime = createWorkflowRuntime(),
): Promise<void> {
	await handleReviewTestingStageInternal(config, agent, linear, state, {
		runAgentWithChatLog,
		appendCodexUsage,
		transitionStage,
		saveRunState,
		safePrComment: (prConfig, runState, body) =>
			safePrComment(prConfig, runState, body, runtime),
		readyPullRequestAfterPassingReview: (prConfig, pr, passed) =>
			readyPullRequestAfterPassingReview(prConfig, pr, passed, {
				markPrReadyForReview: runtime.markPrReadyForReview,
			}),
		loggerInfo: logger.info.bind(logger),
		buildIssueJobLogFields: (runState, stage, stageOptions) => ({
			...buildIssueJobLogFields(runState, stage, stageOptions),
		}),
	});
}

export async function finalizeIssueAfterReviewMerge(
	config: ResolvedProjectConfig,
	notifications: ResolvedNotificationConfig,
	linear: WorkflowLinearClient,
	state: RunState,
	deps?: {
		saveRunState?: typeof saveRunState;
		safeNotifyTaskOutcome?: typeof safeNotifyTaskOutcome;
	},
	runtime: WorkflowRuntime = createWorkflowRuntime(),
): Promise<void> {
	await finalizeIssueAfterReviewMergeInternal(
		config,
		notifications,
		linear,
		state,
		{
			saveRunState: deps?.saveRunState ?? saveRunState,
			safeNotifyTaskOutcome:
				deps?.safeNotifyTaskOutcome ??
				((notifyConfig, runState, outcome, error) =>
					safeNotifyTaskOutcome(
						notifyConfig,
						runState,
						outcome,
						error,
						runtime,
					)),
		},
	);
}

async function handleReceivedStage(
	config: ResolvedProjectConfig,
	linear: WorkflowLinearClient,
	state: RunState,
): Promise<void> {
	await linear.markStage(state.issue.id, "planning");
	await linear.comment(state.issue.id, "ADHD.ai started planning.");
	Object.assign(state, transitionStage(state, "planning"));
	await saveRunState(config.workspacePath, state);
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
	linear: WorkflowLinearClient,
	state: RunState,
	runtime: WorkflowRuntime,
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
		const preparedBranch = await runtime.prepareImplementationBranch(
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
			state.pullRequest = await runtime.createDraftPrFromWorktree(
				config,
				state.issue.key,
				state.issue.title,
			);
		}
	} else if (!config.dryRun) {
		if (!state.pullRequest?.branch) {
			throw new Error("Missing pull request branch for feedback pass");
		}
		const updated = await runtime.updateDraftPrFromWorktree(
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
	linear: WorkflowLinearClient,
	state: RunState,
): Promise<void> {
	Object.assign(state, transitionStage(state, "reviewing"));
	await saveRunState(config.workspacePath, state);
	await linear.markStage(state.issue.id, "reviewing");
	await linear.applyStageLabel(state.issue.id, "reviewing");
}

async function handleDoneReviewMergeStage(
	config: ResolvedProjectConfig,
	notifications: ResolvedNotificationConfig,
	linear: WorkflowLinearClient,
	state: RunState,
	runtime: WorkflowRuntime,
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
			await safeNotifyHumanReviewRequired(
				notifications,
				state,
				score,
				reason,
				runtime,
			);
			state.humanReviewNotifiedAt = new Date().toISOString();
			await saveRunState(config.workspacePath, state);
		}
		return;
	}

	const merged = await safeSquashMergePullRequest(config, state, runtime);
	if (!merged) {
		return;
	}

	await finalizeIssueAfterReviewMerge(
		config,
		notifications,
		linear,
		state,
		undefined,
		runtime,
	);
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

export {
	applyPlannerIssueRefinement,
	parsePlannerComplexityScore,
	parsePlannerDecision,
	parsePlannerIssueRefinement,
	parsePlannerSplitTasks,
	resolveReviewModeForComplexityScore,
	shouldSquashMergePullRequestForComplexityScore,
} from "./plan";
export type { PlannerDecision, PlannerIssueRefinement } from "./plan";
export {
	normalizeFailedReviewBugs,
	readyPullRequestAfterPassingReview,
	resolveReviewFailureStage,
} from "./review-stage";

async function safeLinearComment(
	linear: WorkflowLinearClient,
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
	runtime: WorkflowRuntime,
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
		await runtime.commentOnPr(config, state.pullRequest, body);
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
	runtime: WorkflowRuntime,
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
		return await runtime.squashMergePullRequest(config, state.pullRequest);
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
	runtime: WorkflowRuntime = createWorkflowRuntime(),
): Promise<void> {
	const runLogger = logger.child({
		projectId: state.projectId,
		issueKey: state.issue.key,
		outcome,
	});
	try {
		await runtime.sendTaskOutcomeEmail(
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
	runtime: WorkflowRuntime,
): Promise<void> {
	const runLogger = logger.child({
		projectId: state.projectId,
		issueKey: state.issue.key,
		outcome: "human_review_required",
	});
	try {
		await runtime.sendHumanReviewRequiredEmail(notifications.email, state, {
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
	linear: WorkflowLinearClient,
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
