import { type AgentAdapter, runAdapterAgent } from "adapters";
import { issueBranchName } from "../../../integrations/github";
import { buildFixPrompt, buildImplementPrompt } from "../../../skills/prompts";
import { buildImplementationComment } from "../../../utils/comments";
import { logger } from "../../../utils/logger";
import type {
	ResolvedProjectConfig,
	RunState,
	WorkflowStage,
} from "../../types";
import { runAgentWithChatLog } from "../agents/agent-chat-log";
import { resolveAgentLogMetadata } from "../agents/agent-log-metadata";
import { buildIssueJobLogFields } from "../mission/issue-job-log-fields";
import { saveRunState, transitionStage } from "../state";
import type {
	WorkflowRuntime,
	WorkflowTaskClient,
} from "../types/workflow.types";
import { appendCodexUsage } from "../usage/usage-state";

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

export async function handleImplementingStage(
	config: ResolvedProjectConfig,
	agent: AgentAdapter,
	taskClient: WorkflowTaskClient,
	state: RunState,
	runtime: WorkflowRuntime,
): Promise<void> {
	if (!state.codexSessionId) {
		throw new Error("Missing codex session id for implement step");
	}
	const codexSessionId = state.codexSessionId;
	logger.info(
		buildIssueJobLogFields(state, "in_progress"),
		"Implementing issue",
	);

	await prepareImplementationBranchForStage(config, state, runtime);

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
		...resolveAgentLogMetadata(config, "implementing"),
		skillPath: config.skills.implement,
		prompt,
		invoke: ({ onStream } = { onStream: () => {} }) =>
			runAdapterAgent(agent, {
				role: "implementing",
				prompt,
				sessionId: codexSessionId,
				skills: [{ name: "implementation", path: config.skills.implement }],
				onStream,
			}),
	});
	state.implementationSummary = result.finalMessage || result.stdout;
	appendCodexUsage(state, "implementing", result.usage, {
		agentBackend: result.backend,
	});

	if (!hasExistingPr) {
		if (config.dryRun) {
			state.pullRequest = {
				branch: issueBranchName(state.issue.key, state.issue.branchName),
				title: `[codex] ${state.issue.key}: ${state.issue.title}`,
				url: "https://example.invalid/dry-run",
			};
		} else {
			state.pullRequest = await runtime.createDraftPrFromWorktree(
				config,
				state.issue.key,
				state.issue.title,
				state.issue.branchName,
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
				buildIssueJobLogFields(state, "in_progress"),
				"No code changes after feedback; skipping PR update",
			);
		}
	}
	if (state.pullRequest) {
		await taskClient.linkPullRequest?.(state.issue.id, state.pullRequest);
	}

	state.bugs = [];
	const nextStage: WorkflowStage = "in_review";
	Object.assign(state, transitionStage(state, nextStage));
	await saveRunState(config.workspacePath, state);
	await taskClient.markStage(state.issue.id, nextStage);
	await taskClient.applyStageLabel(state.issue.id, nextStage);
	await taskClient.comment(
		state.issue.id,
		buildImplementationComment(state.pullRequest?.url, result.usage, {
			updated: hasExistingPr,
			fixedBugs,
		}),
	);
	logger.info(
		buildIssueJobLogFields(state, "in_progress"),
		hasExistingPr
			? "Implementation feedback pass completed"
			: "Implementation completed",
	);
}

export async function prepareImplementationBranchForStage(
	config: ResolvedProjectConfig,
	state: RunState,
	runtime: WorkflowRuntime,
): Promise<void> {
	if (config.dryRun) {
		return;
	}
	if (state.executionWorkspace?.mode === "git-worktree") {
		const preparedBranch =
			state.pullRequest?.branch ?? state.executionWorkspace.branch;
		if (state.executionWorkspace.branch !== preparedBranch) {
			throw new Error(
				`Isolated worktree branch '${state.executionWorkspace.branch}' does not match expected branch '${preparedBranch}'`,
			);
		}
		if (!state.pullRequest) {
			state.pullRequest = {
				branch: preparedBranch,
				title: `[codex] ${state.issue.key}: ${state.issue.title}`,
			};
		}
		return;
	}
	const preparedBranch = await runtime.prepareImplementationBranch(
		config,
		state.issue.key,
		state.pullRequest,
		state.issue.branchName,
	);
	if (!state.pullRequest) {
		state.pullRequest = {
			branch: preparedBranch,
			title: `[codex] ${state.issue.key}: ${state.issue.title}`,
		};
	}
}
