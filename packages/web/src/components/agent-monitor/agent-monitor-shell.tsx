"use client";

import { type ReactElement, useEffect, useState } from "react";

import { useAgentMonitor } from "@/lib/agents/use-agent-monitor";

import { AgentMonitorPanel } from "./agent-monitor-panel";

export function AgentMonitorShell(): ReactElement {
	const { health, runtimes } = useAgentMonitor();
	const [activeRuntimeTabId, setActiveRuntimeTabId] = useState<string | null>(
		null,
	);
	const [showDetails, setShowDetails] = useState<boolean>(false);

	useEffect(() => {
		if (runtimes.tabs.length === 0) {
			setActiveRuntimeTabId(null);
			return;
		}

		setActiveRuntimeTabId((current) => {
			if (current && runtimes.tabs.some((tab) => tab.id === current)) {
				return current;
			}
			return runtimes.tabs[0]?.id ?? null;
		});
	}, [runtimes.tabs]);

	return (
		<AgentMonitorPanel
			health={health}
			runtimes={runtimes}
			activeRuntimeTabId={activeRuntimeTabId}
			showDetails={showDetails}
			onRuntimeTabChange={setActiveRuntimeTabId}
			onToggleDetails={() => setShowDetails((value) => !value)}
		/>
	);
}
