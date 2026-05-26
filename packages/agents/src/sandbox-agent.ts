import { Agent } from "./agent";
import type { SandboxAgentOptions } from "./types/agent.types";

export class SandboxAgent<TInput = unknown, TOutput = unknown> extends Agent<
	TInput,
	TOutput
> {
	readonly workspacePath: string;
	readonly sandbox: "read-only" | "workspace-write" | "danger-full-access";

	constructor(options: SandboxAgentOptions<TInput, TOutput>) {
		super(options);
		this.workspacePath = options.workspacePath;
		this.sandbox = options.sandbox ?? "workspace-write";
	}
}
