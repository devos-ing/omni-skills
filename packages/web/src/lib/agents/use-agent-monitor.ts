"use client";

import { useMemo } from "react";

import type { AgentRecord } from "@/lib/api";

import {
	useAgentHealthQuery,
	useAgentRuntimesQuery,
} from "./agent-monitor-query";
import type {
	AgentHealthViewModel,
	AgentRuntimeTabsViewModel,
} from "./types/agent-monitor.types";

interface UseAgentMonitorResult {
	health: AgentHealthViewModel;
	runtimes: AgentRuntimeTabsViewModel;
}

const RUNTIME_LABELS: Record<string, string> = {
	"claude-code": "Claude",
	claude_code: "Claude",
	claudecode: "Claude",
	claude: "Claude",
	codex: "Codex",
	gemini: "Gemini",
	"github-copilot": "GitHub Copilot",
	github_copilot: "GitHub Copilot",
	githubcopilot: "GitHub Copilot",
	opencode: "OpenCode",
	"open-code": "OpenCode",
	open_code: "OpenCode",
};

function deriveHealthStatus(
	isPending: boolean,
	isError: boolean,
): AgentHealthViewModel["status"] {
	if (isPending) {
		return "loading";
	}

	if (isError) {
		return "error";
	}

	return "healthy";
}

function deriveHealthSummary(status: AgentHealthViewModel["status"]): string {
	switch (status) {
		case "loading":
			return "Loading latest server health...";
		case "error":
			return "Unable to fetch server health";
		case "healthy":
			return "Server health endpoint reports ok";
	}
}

function formatRuntimeLabel(backend: string): string {
	const trimmedBackend = backend.trim();
	if (!trimmedBackend) {
		return "Unknown";
	}

	const normalized = trimmedBackend.toLowerCase();
	const knownLabel = RUNTIME_LABELS[normalized];
	if (knownLabel) {
		return knownLabel;
	}

	return trimmedBackend
		.split(/[-_\s]+/)
		.filter(Boolean)
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(" ");
}

function deriveRuntimeTabs(
	agents: AgentRecord[] | undefined,
	isPending: boolean,
	isError: boolean,
): AgentRuntimeTabsViewModel {
	if (isPending) {
		return {
			status: "loading",
			summary: "Loading runtime tabs...",
			tabs: [],
		};
	}

	if (isError) {
		return {
			status: "error",
			summary: "Unable to fetch runtime tabs",
			tabs: [],
		};
	}

	const tabs = (agents ?? []).map((agent) => ({
		id: agent.id,
		name: agent.name,
		runtimeLabel: formatRuntimeLabel(agent.backend),
		model: agent.model,
	}));

	if (tabs.length === 0) {
		return {
			status: "empty",
			summary: "No runtime tabs available",
			tabs,
		};
	}

	return {
		status: "ready",
		summary: `${tabs.length} runtime${tabs.length === 1 ? "" : "s"} available`,
		tabs,
	};
}

export function useAgentMonitor(): UseAgentMonitorResult {
	const { isPending, isError } = useAgentHealthQuery();
	const runtimesQuery = useAgentRuntimesQuery();
	const status = deriveHealthStatus(isPending, isError);
	const runtimes = useMemo(
		() =>
			deriveRuntimeTabs(
				runtimesQuery.data,
				runtimesQuery.isPending,
				runtimesQuery.isError,
			),
		[runtimesQuery.data, runtimesQuery.isPending, runtimesQuery.isError],
	);

	return {
		health: {
			status,
			summary: deriveHealthSummary(status),
		},
		runtimes,
	};
}
