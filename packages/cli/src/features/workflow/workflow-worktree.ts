import path from "node:path";
import type {
	ResolvedProjectConfig,
	RunOptions,
	RunState,
} from "../../features/types";
import { logger } from "../../utils/logger";
import { normalizeIssueKey } from "./state";
import type { WorkflowRuntime } from "./workflow-runtime";

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
		return state.executionWorkspace.path;
	}
	const configuredRoot = config.workflow.isolatedWorktrees?.root;
	const root =
		configuredRoot ??
		path.join(
			config.workspacePath,
			".piv-loop",
			"projects",
			config.id,
			"worktrees",
		);
	const issueKey = normalizeIssueKey(state.issue.key).toLowerCase();
	return configuredRoot
		? path.join(root, config.id, issueKey)
		: path.join(root, issueKey);
}

export async function prepareIsolatedExecutionConfig(
	config: ResolvedProjectConfig,
	state: RunState,
	runtime: WorkflowRuntime,
): Promise<ResolvedProjectConfig> {
	const worktreePath = isolatedWorktreePath(config, state);
	await runtime.ensureBaseBranchFresh(config);
	const branch = await runtime.ensureIssueWorktree(
		config,
		state.issue.key,
		state.pullRequest,
		worktreePath,
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
		(state.stage !== "done" && state.stage !== "blocked")
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
