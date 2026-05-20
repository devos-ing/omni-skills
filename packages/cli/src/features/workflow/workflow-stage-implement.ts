import type { AgentAdapter } from "adapters";
import type {
	ResolvedProjectConfig,
	RunState,
	WorkflowStage,
} from "../../features/types";
import { issueBranchName } from "../../integrations/github";
import { buildFixPrompt, buildImplementPrompt } from "../../skills/prompts";
import { buildImplementationComment } from "../../utils/comments";
import { logger } from "../../utils/logger";
import { emitActionProgress, emitStageProgress } from "./progress";
import type { WorkflowLinearClient, WorkflowRuntime } from "./workflow-runtime";

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
	linear: WorkflowLinearClient,
	state: RunState,
	runtime: WorkflowRuntime,
	deps: {
		runAgentWithChatLog: (input: {
			workspacePath: string;
			projectId: string;
			issue: RunState["issue"];
			agentRole: "implementing";
			skillPath: string;
			prompt: string;
			invoke: () => Promise<{
				finalMessage: string;
				stdout: string;
				sessionId?: string;
				usage?: {
					inputTokens?: number;
					outputTokens?: number;
					totalTokens?: number;
				};
			}>;
		}) => Promise<{
			finalMessage: string;
			stdout: string;
			usage?: {
				inputTokens?: number;
				outputTokens?: number;
				totalTokens?: number;
			};
		}>;
		appendCodexUsage: (
			state: RunState,
			stage: "implementing",
			usage:
				| { inputTokens?: number; outputTokens?: number; totalTokens?: number }
				| undefined,
		) => void;
		transitionStage: (state: RunState, to: WorkflowStage) => RunState;
		saveRunState: (workspacePath: string, state: RunState) => Promise<void>;
		buildIssueJobLogFields: (
			state: RunState,
			stage: string,
			options?: { resumed?: boolean },
		) => Record<string, unknown>;
	},
): Promise<void> {
	if (!state.codexSessionId) {
		throw new Error("Missing codex session id for implement step");
	}
	const codexSessionId = state.codexSessionId;
	logger.info(
		deps.buildIssueJobLogFields(state, "implementing"),
		"Implementing issue",
	);
	emitStageProgress(state, "implementing", "started", "Implementing issue");
	emitActionProgress(state, "implementing", "implementation", "started");

	if (!config.dryRun) {
		emitActionProgress(state, "implementing", "prepare-branch", "started");
		const preparedBranch = await runtime.prepareImplementationBranch(
			config,
			state.issue.key,
			state.pullRequest,
		);
		emitActionProgress(state, "implementing", "prepare-branch", "succeeded", {
			detail: preparedBranch,
		});
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
	const result = await deps.runAgentWithChatLog({
		workspacePath: config.workspacePath,
		projectId: config.id,
		issue: state.issue,
		agentRole: "implementing",
		skillPath: config.skills.implement,
		prompt,
		invoke: () => agent.resume(codexSessionId, prompt),
	});
	state.implementationSummary = result.finalMessage || result.stdout;
	deps.appendCodexUsage(state, "implementing", result.usage);
	emitActionProgress(state, "implementing", "implementation", "succeeded", {
		detail: state.implementationSummary,
	});

	if (!hasExistingPr) {
		emitActionProgress(state, "implementing", "create-pr", "started");
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
		emitActionProgress(state, "implementing", "create-pr", "succeeded", {
			detail: state.pullRequest.url ?? state.pullRequest.branch,
		});
	} else if (!config.dryRun) {
		if (!state.pullRequest?.branch) {
			throw new Error("Missing pull request branch for feedback pass");
		}
		emitActionProgress(state, "implementing", "update-pr", "started");
		const updated = await runtime.updateDraftPrFromWorktree(
			config,
			state.pullRequest.branch,
			state.issue.key,
		);
		if (!updated) {
			logger.info(
				deps.buildIssueJobLogFields(state, "implementing"),
				"No code changes after feedback; skipping PR update",
			);
		}
		emitActionProgress(state, "implementing", "update-pr", "succeeded", {
			detail: updated ? "Updated pull request" : "No code changes",
		});
	}
	if (state.pullRequest) {
		await linear.linkPullRequest?.(state.issue.id, state.pullRequest);
	}

	state.bugs = [];
	const nextStage: WorkflowStage = "reviewing";
	Object.assign(state, deps.transitionStage(state, nextStage));
	await deps.saveRunState(config.workspacePath, state);
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
		deps.buildIssueJobLogFields(state, "implementing"),
		hasExistingPr
			? "Implementation feedback pass completed"
			: "Implementation completed",
	);
	emitStageProgress(
		state,
		"implementing",
		"succeeded",
		hasExistingPr
			? "Implementation feedback pass completed"
			: "Implementation completed",
	);
}
