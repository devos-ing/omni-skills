import type { AgentRecord } from "@/lib/api";

import type { RuntimeSummary } from "./types/runtimes-panel.types";

const RUNTIME_LABELS: Record<string, string> = {
	"claude-code": "Claude",
	claude_code: "Claude",
	claudecode: "Claude",
	claude: "Claude",
	codex: "Codex",
	cursor: "Cursor",
	gemini: "Gemini",
	"github-copilot": "GitHub Copilot",
	github_copilot: "GitHub Copilot",
	githubcopilot: "GitHub Copilot",
	opencode: "OpenCode",
	"open-code": "OpenCode",
	open_code: "OpenCode",
};

export function deriveRuntimeSummaries(
	agents: AgentRecord[],
): RuntimeSummary[] {
	const grouped = new Map<
		string,
		{
			backends: Set<string>;
			models: Set<string>;
			owners: Set<string>;
			totalConcurrency: number;
			updatedAt: string;
			agents: RuntimeSummary["agents"];
		}
	>();

	for (const agent of agents) {
		const runtimeId = runtimeIdForAgent(agent);
		const group = grouped.get(runtimeId) ?? {
			backends: new Set<string>(),
			models: new Set<string>(),
			owners: new Set<string>(),
			totalConcurrency: 0,
			updatedAt: "",
			agents: [],
		};

		group.backends.add(formatRuntimeLabel(agent.backend));
		group.models.add(agent.model);
		group.owners.add(agent.owner);
		group.totalConcurrency += agent.concurrency;
		group.updatedAt = latestTimestamp(group.updatedAt, agent.updatedAt);
		group.agents.push({
			id: agent.id,
			name: agent.name,
			backend: agent.backend,
			model: agent.model,
			concurrency: agent.concurrency,
			owner: agent.owner,
			updatedAt: agent.updatedAt,
		});
		grouped.set(runtimeId, group);
	}

	return [...grouped.entries()]
		.map(([id, group]) => ({
			id,
			label: formatRuntimeLabel(id),
			agentCount: group.agents.length,
			totalConcurrency: group.totalConcurrency,
			backendLabels: sortedValues(group.backends),
			models: sortedValues(group.models),
			owners: sortedValues(group.owners),
			updatedAt: group.updatedAt,
			agents: group.agents.sort(compareByName),
		}))
		.sort((left, right) => left.label.localeCompare(right.label));
}

export function formatRuntimeLabel(value: string): string {
	const trimmedValue = value.trim();
	if (!trimmedValue) {
		return "Unknown";
	}

	const normalized = trimmedValue.toLowerCase();
	const knownLabel = RUNTIME_LABELS[normalized];
	if (knownLabel) {
		return knownLabel;
	}

	return trimmedValue
		.split(/[-_\s]+/)
		.filter(Boolean)
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(" ");
}

function runtimeIdForAgent(agent: AgentRecord): string {
	const runtime = agent.runtime.trim() || agent.backend.trim();
	return runtime.toLowerCase() || "unknown";
}

function sortedValues(values: Set<string>): string[] {
	return [...values].sort((left, right) => left.localeCompare(right));
}

function compareByName(
	left: RuntimeSummary["agents"][number],
	right: RuntimeSummary["agents"][number],
): number {
	return left.name.localeCompare(right.name);
}

function latestTimestamp(current: string, candidate: string): string {
	const candidateTime = Date.parse(candidate);
	if (Number.isNaN(candidateTime)) {
		return current;
	}

	const currentTime = Date.parse(current);
	if (Number.isNaN(currentTime)) {
		return candidate;
	}

	return candidateTime > currentTime ? candidate : current;
}
