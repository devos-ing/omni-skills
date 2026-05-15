import type { AgentRecord } from "@/lib/api";

export interface AgentDraft {
	name: string;
	description: string;
	logo: string;
	runtime: string;
	backend: string;
	model: string;
	concurrency: string;
	owner: string;
	createdAt: string;
	updatedAt: string;
	skills: string;
	recentWork: string;
	activity: string;
	instructions: string;
}

export function createAgentDraft(agent: AgentRecord): AgentDraft {
	return {
		name: agent.name,
		description: agent.description,
		logo: agent.logo,
		runtime: agent.runtime,
		backend: agent.backend,
		model: agent.model,
		concurrency: String(agent.concurrency),
		owner: agent.owner,
		createdAt: agent.createdAt,
		updatedAt: agent.updatedAt,
		skills: agent.skills.join("\n"),
		recentWork: agent.recentWork.join("\n"),
		activity: agent.activity.join("\n"),
		instructions: agent.instructions,
	};
}

export function parseLineList(value: string): string[] {
	return value
		.split("\n")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}
