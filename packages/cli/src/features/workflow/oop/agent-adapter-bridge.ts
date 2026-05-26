import type { AgentAdapter, AgentResult } from "adapters";
import { Agent, SandboxAgent } from "devos-agents";
import type { ResolvedProjectConfig } from "../../types";

export type WorkflowAgentRole =
	| "planning"
	| "implementing"
	| "review-testing"
	| "github-comment";

export interface WorkflowAgentBridgeInput {
	role: WorkflowAgentRole;
	prompt: string;
	sessionId?: string;
}

export class AgentAdapterBridge {
	constructor(
		private readonly adapter: AgentAdapter,
		private readonly config: ResolvedProjectConfig,
	) {}

	createAgent(
		role: WorkflowAgentRole,
	): Agent<WorkflowAgentBridgeInput, AgentResult> {
		const options = {
			name: role,
			instructions: `Run the ${role} workflow role for devos.ing.`,
			runner: {
				run: async ({ input }: { input: WorkflowAgentBridgeInput }) => {
					const output = await this.runRole(input);
					return {
						output,
						finalMessage: output.finalMessage || output.stdout,
						sessionId: output.sessionId,
						usage: output.usage,
					};
				},
			},
		};
		if (role === "implementing" || role === "review-testing") {
			return new SandboxAgent({
				...options,
				workspacePath: this.config.executionPath,
				sandbox: this.config.codex.sandbox,
			});
		}
		return new Agent(options);
	}

	private runRole(input: WorkflowAgentBridgeInput): Promise<AgentResult> {
		if (input.role === "planning") {
			return input.sessionId
				? this.adapter.resume(input.sessionId, input.prompt)
				: this.adapter.runPlan(input.prompt);
		}
		if (input.role === "implementing") {
			if (!input.sessionId) {
				throw new Error("Implementing agent requires a session id");
			}
			return this.adapter.resume(input.sessionId, input.prompt);
		}
		if (input.role === "review-testing") {
			return this.adapter.runReview(input.prompt);
		}
		return this.adapter.runGithubComment(input.prompt);
	}
}
