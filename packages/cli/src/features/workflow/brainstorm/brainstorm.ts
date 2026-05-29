import { runAdapterAgent } from "adapters";
import type { AgentAdapter } from "adapters";
import { buildBrainstormPrompt } from "../../../skills/prompts";
import type { ResolvedProjectConfig, RunState } from "../../types";
import { runAgentWithChatLog } from "../agents/agent-chat-log";
import { resolveAgentLogMetadata } from "../agents/agent-log-metadata";
import { saveRunState } from "../state";
import { transitionStage } from "../state";
import type {
	BrainstormTaskClient,
	HandleBrainstormStageDeps,
} from "../types/brainstorm.types";
import { appendCodexUsage } from "../usage/usage-state";
import { parseBrainstormDecision } from "./brainstorm-parser";

export async function handleBrainstormStage(
	config: ResolvedProjectConfig,
	agent: AgentAdapter,
	taskClient: BrainstormTaskClient,
	state: RunState,
	deps: HandleBrainstormStageDeps = defaultBrainstormDeps(),
): Promise<void> {
	deps.loggerInfo(
		deps.buildIssueJobLogFields(state, "brainstorm"),
		"Brainstorming issue",
	);
	const answers = await taskClient.listChatClarificationAnswers(state.issue.id);
	const prompt = await buildBrainstormPrompt(
		config.skills.brainstorm,
		state.issue,
		{
			answers,
		},
	);
	const result = await deps.runAgentWithChatLog({
		workspacePath: config.workspacePath,
		projectId: config.id,
		issue: state.issue,
		agentRole: "brainstorm",
		...resolveAgentLogMetadata(config, "brainstorm"),
		skillPath: config.skills.brainstorm,
		prompt,
		invoke: ({ onStream } = { onStream: () => {} }) =>
			runAdapterAgent(agent, {
				role: "brainstorm",
				prompt,
				sessionId: state.codexSessionId,
				skills: [{ name: "brainstorm", path: config.skills.brainstorm }],
				onStream,
			}),
	});
	state.codexSessionId = result.sessionId ?? state.codexSessionId;
	const decision = parseBrainstormDecision(
		result.finalMessage || result.stdout,
	);
	deps.appendCodexUsage(state, "brainstorming", result.usage, {
		agentBackend: result.backend,
	});
	if (decision.result === "needs_info") {
		state.brainstormNeedsInfoQuestions = decision.questions;
		await taskClient.publishChatClarification(
			state.issue.id,
			decision.questions,
		);
		await deps.saveRunState(config.workspacePath, state);
		return;
	}
	state.brainstormSummary = decision.summary;
	state.brainstormNeedsInfoQuestions = undefined;
	Object.assign(state, deps.transitionStage(state, "plan"));
	await deps.saveRunState(config.workspacePath, state);
}

function defaultBrainstormDeps(): HandleBrainstormStageDeps {
	return {
		runAgentWithChatLog,
		appendCodexUsage,
		saveRunState,
		transitionStage,
		loggerInfo: () => {},
		buildIssueJobLogFields: () => ({}),
	};
}
