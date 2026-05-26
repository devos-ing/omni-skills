import { Agent } from "./agent";
import type { AgentRunResult } from "./types/agent.types";
import type {
	WorkflowCallResult,
	WorkflowOptions,
	WorkflowPhaseOptions,
} from "./types/workflow.types";

export class WorkflowPhase {
	readonly title: string;
	readonly description?: string;
	readonly agentNames: string[];

	constructor(options: WorkflowPhaseOptions) {
		this.title = options.title;
		this.description = options.description;
		this.agentNames = options.agentNames ?? [];
	}
}

export class Workflow {
	readonly name: string;
	readonly description?: string;
	readonly phases: WorkflowPhase[];
	private readonly agents = new Map<string, Agent>();

	constructor(options: WorkflowOptions) {
		this.name = options.name;
		this.description = options.description;
		this.phases = (options.phases ?? options.phrases ?? []).map(
			(phase) => new WorkflowPhase(phase),
		);
		for (const agent of options.agents ?? []) {
			if (agent instanceof Agent) this.agents.set(agent.name, agent);
		}
	}

	addAgent(agent: Agent): this {
		this.agents.set(agent.name, agent);
		return this;
	}

	setPhase(title: string): WorkflowPhaseHandle {
		const phase = this.phases.find((item) => item.title === title);
		if (!phase) throw new Error(`Unknown workflow phase: ${title}`);
		return new WorkflowPhaseHandle(phase, this.agents);
	}

	setPhrase(title: string): WorkflowPhaseHandle {
		return this.setPhase(title);
	}
}

export class WorkflowPhaseHandle {
	constructor(
		private readonly phase: WorkflowPhase,
		private readonly agents: Map<string, Agent>,
	) {}

	async callAgent<TOutput = unknown>(
		agentName: string,
		input: unknown,
	): Promise<WorkflowCallResult<TOutput>> {
		const agent = this.agents.get(agentName);
		if (!agent) throw new Error(`Unknown workflow agent: ${agentName}`);
		const result = (await agent.run(input)) as AgentRunResult<TOutput>;
		return { phase: this.phase.title, agent: agentName, result };
	}
}
