import type { Agent } from "./agent";
import type { AgentRunResult } from "./types/agent.types";

export async function run<TInput = unknown, TOutput = unknown>(
	agent: Agent<TInput, TOutput>,
	input: TInput,
): Promise<AgentRunResult<TOutput>> {
	return agent.run(input);
}
