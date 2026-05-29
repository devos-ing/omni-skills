import path from "node:path";
import { logger } from "../../../utils/logger";
import type { ResolvedProjectConfig, RunOptions, RunState } from "../../types";
import { normalizeIssueKey } from "../state";
import type { WorkflowRuntime } from "../types/workflow.types";

export function shouldUseIsolatedWorktree(
	config: ResolvedProjectConfig,
	options: RunOptions,
	effectiveConcurrency: number,
): boolean {
	return (
		options.isolatedWorktrees === true ||
		config.workflow.isolatedWorktrees?.enabled === true ||
		effectiveConcurrency > 1
	);
}

export function isolatedWorktreePath(
	config: ResolvedProjectConfig,
	state: RunState,
): string {
	if (state.executionWorkspace?.mode === "git-worktree") {
		return path.resolve(state.executionWorkspace.path);
	}
	const configuredRoot = config.workflow.isolatedWorktrees?.root;
	const root = configuredRoot
		? path.resolve(configuredRoot)
		: path.resolve(
				config.workspacePath,
				".devos",
				"projects",
				config.id,
				"worktrees",
			);
	const issueKey = worktreePathKey(state);
	return configuredRoot
		? path.join(root, config.id, issueKey)
		: path.join(root, issueKey);
}

function worktreePathKey(state: RunState): string {
	const branchName = state.issue.branchName?.trim();
	if (branchName) {
		return branchName.replace(/[\\/]+/g, "-").toLowerCase();
	}
	return normalizeIssueKey(state.issue.key).toLowerCase();
}

export async function prepareIsolatedExecutionConfig(
	config: ResolvedProjectConfig,
	state: RunState,
	runtime: WorkflowRuntime,
): Promise<ResolvedProjectConfig> {
	const isolatedConfig = await prepareIsolatedExecutionWorkspace(
		config,
		state,
		runtime,
	);
	await runtime.prepareWorktreeDependencies(isolatedConfig.executionPath);
	return isolatedConfig;
}

export async function prepareIsolatedExecutionWorkspace(
	config: ResolvedProjectConfig,
	state: RunState,
	runtime: WorkflowRuntime,
): Promise<ResolvedProjectConfig> {
	const worktreePath = isolatedWorktreePath(config, state);
	logger.info(
		{
			projectId: state.projectId,
			issueKey: state.issue.key,
			worktreePath,
		},
		"Refreshing base branch for isolated worktree",
	);
	await runtime.ensureBaseBranchFresh(config);
	logger.info(
		{
			projectId: state.projectId,
			issueKey: state.issue.key,
			worktreePath,
		},
		"Ensuring isolated issue worktree",
	);
	const branch = await runtime.ensureIssueWorktree(
		config,
		state.issue.key,
		state.pullRequest,
		worktreePath,
		state.issue.branchName,
	);
	state.executionWorkspace = {
		mode: "git-worktree",
		path: worktreePath,
		branch,
		createdAt: state.executionWorkspace?.createdAt ?? new Date().toISOString(),
	};
	return {
		...config,
		executionPath: worktreePath,
	};
}

export async function cleanupTerminalIsolatedWorktree(
	config: ResolvedProjectConfig,
	state: RunState,
	runtime: WorkflowRuntime,
): Promise<boolean> {
	const workspace = state.executionWorkspace;
	if (
		workspace?.mode !== "git-worktree" ||
		(state.stage !== "done" &&
			state.stage !== "failed" &&
			state.stage !== "canceled")
	) {
		return false;
	}
	const result = await runtime.removeIssueWorktree(config, workspace.path);
	if (result.removed) {
		state.executionWorkspace = undefined;
		return true;
	}
	logger.warn(
		{
			projectId: state.projectId,
			issueKey: state.issue.key,
			worktreePath: workspace.path,
			reason: result.reason,
		},
		"Retaining isolated worktree after cleanup failed",
	);
	return false;
}
