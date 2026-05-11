import type { AgentAdapter } from "../agent-adapters";
import { sortIssuesByPriority } from "../services/linear";
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
	resolvePollingSettings,
	shouldStopPolling,
	sleep,
} from "./workflow-polling";
import {
	buildPrioritizedIssueQueue as buildPrioritizedIssueQueueHelper,
	buildReviewOnlyIssueQueue,
	dedupeIssuesByKey,
	isReviewOnlyEligibleRunState,
	isReviewOnlyExecutableStage,
	isRunStateStaleForRetry as isRunStateStaleForRetryHelper,
	selectReviewOnlyIssueKeys,
	selectStaleRunIssueKeys as selectStaleRunIssueKeysHelper,
	shouldRetryRunStage,
	shouldSkipReviewOnlyRunState,
} from "./workflow-queue";
import { routeProjectsForIssueProjectId } from "./workflow-routing";
import {
	type WorkflowLinearClient,
	type WorkflowRuntime,
	createWorkflowRuntime,
} from "./workflow-runtime";
import {
	safeLinearComment,
	safeLinearMoveToCanceled,
	safeNotifyHumanReviewRequired,
	safeNotifyTaskOutcome,
	safePrComment,
	safeSquashMergePullRequest,
} from "./workflow-safe";
import {
	fixedBugsForImplementationComment,
	handleImplementingStage,
} from "./workflow-stage-implement";
import {
	handleDoneReviewMergeStage,
	handlePrCreatedStage,
	handleReceivedStage,
	resolveReviewOnlyBootstrapStage,
} from "./workflow-stages";
import type {
	IssueJobLogFields,
	PollingSettings,
	WorkflowIssue,
} from "./workflow.types";

export { buildRunLeaseOwnerId } from "./workflow-lease";
import type {
	CodexUsageRecord,
	ResolvedNotificationConfig,
	ResolvedProjectConfig,
	RunOptions,
	RunState,
} from "./types";
export type {
	IssueProjectRoutingResult,
	ReviewOnlyQueueBuildResult,
} from "./workflow.types";

export { runAgentWithChatLog } from "./agent-chat-log";

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
		WorkflowIssue["pullRequest"]
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
			{
				saveRunState,
				safeNotifyHumanReviewRequired,
				safeSquashMergePullRequest,
				finalizeIssueAfterReviewMerge: (
					finalizeConfig,
					finalizeNotifications,
					finalizeLinear,
					finalizeState,
					finalizeRuntime,
				) =>
					finalizeIssueAfterReviewMerge(
						finalizeConfig,
						finalizeNotifications,
						finalizeLinear,
						finalizeState,
						undefined,
						finalizeRuntime,
					),
			},
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
			await handleReceivedStage(config, linear, state, {
				transitionStage,
				saveRunState,
			});
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
			await handleImplementingStage(config, agent, linear, state, runtime, {
				runAgentWithChatLog,
				appendCodexUsage: (runState, stage, usage) =>
					appendCodexUsage(runState, stage, usage),
				transitionStage,
				saveRunState,
				buildIssueJobLogFields: (runState, stage, stageOptions) => ({
					...buildIssueJobLogFields(runState, stage, stageOptions),
				}),
			});
			continue;
		}

		if (state.stage === "pr_created") {
			await handlePrCreatedStage(config, linear, state, {
				transitionStage,
				saveRunState,
			});
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

export function isRunStateStaleForRetry(
	state: RunState,
	nowMs: number,
	timeoutMs: number,
): boolean {
	return isRunStateStaleForRetryHelper(
		state,
		nowMs,
		timeoutMs,
		isRunLeaseExpired,
	);
}

export function selectStaleRunIssueKeys(
	runStates: RunState[],
	nowMs: number,
	timeoutMs: number,
): string[] {
	return selectStaleRunIssueKeysHelper(
		runStates,
		nowMs,
		timeoutMs,
		isRunLeaseExpired,
	);
}

export {
	isReviewOnlyEligibleRunState,
	isReviewOnlyExecutableStage,
	selectReviewOnlyIssueKeys,
	shouldRetryRunStage,
	shouldSkipReviewOnlyRunState,
	buildReviewOnlyIssueQueue,
} from "./workflow-queue";
export { resolveReviewOnlyBootstrapStage } from "./workflow-stages";
export { fixedBugsForImplementationComment } from "./workflow-stage-implement";
export {
	resolvePollingSettings,
	shouldStopPolling,
	sleep,
} from "./workflow-polling";
export { routeProjectsForIssueProjectId } from "./workflow-routing";
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
