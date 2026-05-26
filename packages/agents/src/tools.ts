import type { Tool } from "./types/agent.types";

export class FunctionTool<TInput = unknown, TOutput = unknown>
	implements Tool<TInput, TOutput>
{
	readonly name: string;
	readonly description?: string;
	private readonly fn: (input: TInput) => Promise<TOutput> | TOutput;

	constructor(options: Tool<TInput, TOutput>) {
		this.name = options.name;
		this.description = options.description;
		this.fn = options.invoke;
	}

	invoke(input: TInput): Promise<TOutput> | TOutput {
		return this.fn(input);
	}
}

export class McpTool<TInput = unknown, TOutput = unknown> extends FunctionTool<
	TInput,
	TOutput
> {}

export class HostedTool<
	TInput = unknown,
	TOutput = unknown,
> extends FunctionTool<TInput, TOutput> {}
