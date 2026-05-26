import type {
	AgentOptions,
	AgentRunInput,
	AgentRunResult,
	AgentRunner,
	Guardrail,
	Handoff,
	Tool,
} from "./types/agent.types";

export class Agent<TInput = unknown, TOutput = unknown> {
	readonly name: string;
	readonly instructions: string;
	readonly model?: string;
	readonly tools: Tool[];
	readonly guardrails: Guardrail<TInput, TOutput>[];
	readonly handoffs: Handoff[];
	private readonly runner?: AgentRunner<TInput, TOutput>;

	constructor(options: AgentOptions<TInput, TOutput>) {
		this.name = options.name;
		this.instructions = options.instructions;
		this.model = options.model;
		this.tools = options.tools ?? [];
		this.guardrails = options.guardrails ?? [];
		this.handoffs = options.handoffs ?? [];
		this.runner = options.runner;
	}

	async run(input: TInput, options: Omit<AgentRunInput<TInput>, "input"> = {}) {
		await this.checkGuardrails("input", { input });
		const result = this.runner
			? await this.runner.run({ ...options, input })
			: this.defaultRun(input, options);
		await this.checkGuardrails("output", { output: result.output });
		return result;
	}

	private defaultRun(
		input: TInput,
		options: Omit<AgentRunInput<TInput>, "input">,
	): AgentRunResult<TOutput> {
		const output = String(input) as TOutput;
		return {
			output,
			finalMessage: String(output),
			sessionId: options.sessionId,
			traceId: options.traceId,
		};
	}

	private async checkGuardrails(
		stage: "input" | "output",
		payload: { input?: TInput; output?: TOutput },
	): Promise<void> {
		for (const guardrail of this.guardrails.filter(
			(item) => item.stage === stage,
		)) {
			const result = await guardrail.check({ agent: this.name, ...payload });
			if (!result.ok) {
				throw new Error(
					`Agent '${this.name}' ${stage} guardrail '${guardrail.name}' failed${
						result.reason ? `: ${result.reason}` : ""
					}`,
				);
			}
		}
	}
}
