export interface AgentRunInput<TInput = unknown> {
	input: TInput;
	sessionId?: string;
	traceId?: string;
}

export interface AgentRunResult<TOutput = unknown> {
	output: TOutput;
	finalMessage?: string;
	sessionId?: string;
	traceId?: string;
	usage?: {
		inputTokens?: number;
		outputTokens?: number;
		totalTokens?: number;
	};
}

export interface AgentRunner<TInput = unknown, TOutput = unknown> {
	run(input: AgentRunInput<TInput>): Promise<AgentRunResult<TOutput>>;
}

export interface AgentOptions<TInput = unknown, TOutput = unknown> {
	name: string;
	instructions: string;
	model?: string;
	tools?: Tool[];
	guardrails?: Guardrail<TInput, TOutput>[];
	handoffs?: Handoff[];
	runner?: AgentRunner<TInput, TOutput>;
}

export interface SandboxAgentOptions<TInput = unknown, TOutput = unknown>
	extends AgentOptions<TInput, TOutput> {
	workspacePath: string;
	sandbox?: "read-only" | "workspace-write" | "danger-full-access";
}

export interface Tool<TInput = unknown, TOutput = unknown> {
	name: string;
	description?: string;
	invoke(input: TInput): Promise<TOutput> | TOutput;
}

export type GuardrailStage = "input" | "output" | "tool";

export interface GuardrailResult {
	ok: boolean;
	reason?: string;
}

export interface Guardrail<TInput = unknown, TOutput = unknown> {
	name: string;
	stage: GuardrailStage;
	check(input: {
		agent: string;
		input?: TInput;
		output?: TOutput;
	}): Promise<GuardrailResult> | GuardrailResult;
}

export interface Handoff {
	name: string;
	description?: string;
	agent: string;
}
