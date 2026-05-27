import type { z } from "zod";
import { parseWithSchema } from "./schema-validation";
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
	private readonly inputSchema?: z.ZodType<TInput>;
	private readonly outputSchema?: z.ZodType<TOutput>;
	private readonly runner?: AgentRunner<TInput, TOutput>;

	constructor(options: AgentOptions<TInput, TOutput>) {
		this.name = options.name;
		this.instructions = options.instructions;
		this.model = options.model;
		this.tools = options.tools ?? [];
		this.guardrails = options.guardrails ?? [];
		this.handoffs = options.handoffs ?? [];
		this.inputSchema = options.inputSchema;
		this.outputSchema = options.outputSchema;
		this.runner = options.runner;
	}

	async run(input: TInput, options: Omit<AgentRunInput<TInput>, "input"> = {}) {
		const parsedInput = parseWithSchema(
			this.inputSchema,
			input,
			`Agent '${this.name}' input schema validation failed`,
		);
		await this.checkGuardrails("input", { input: parsedInput });
		const result = this.runner
			? await this.runner.run({
					...options,
					agent: options.agent ?? this.toDescriptor(),
					input: parsedInput,
				})
			: this.defaultRun(parsedInput, options);
		const parsedOutput = parseWithSchema(
			this.outputSchema,
			result.output,
			`Agent '${this.name}' output schema validation failed`,
		);
		await this.checkGuardrails("output", { output: parsedOutput });
		return { ...result, output: parsedOutput };
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

	private toDescriptor() {
		return {
			name: this.name,
			instructions: this.instructions,
			model: this.model,
			tools: this.tools.map((tool) => ({
				name: tool.name,
				description: tool.description,
			})),
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
