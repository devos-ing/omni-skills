"use client";

import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import type {
	AgentHealthViewModel,
	AgentRuntimeTabViewModel,
	AgentRuntimeTabsViewModel,
} from "@/lib/agents/types/agent-monitor.types";

import { AgentMonitorSkeleton } from "./agent-monitor-skeleton";

interface AgentMonitorPanelProps {
	health: AgentHealthViewModel;
	runtimes: AgentRuntimeTabsViewModel;
	activeRuntimeTabId: string | null;
	showDetails: boolean;
	onRuntimeTabChange: (tabId: string) => void;
	onToggleDetails: () => void;
}

export function AgentMonitorPanel({
	health,
	runtimes,
	activeRuntimeTabId,
	showDetails,
	onRuntimeTabChange,
	onToggleDetails,
}: AgentMonitorPanelProps): ReactElement {
	if (health.status === "loading") {
		return <AgentMonitorSkeleton />;
	}

	const activeRuntimeTab =
		runtimes.tabs.find((tab) => tab.id === activeRuntimeTabId) ??
		runtimes.tabs[0] ??
		null;
	const resolvedActiveRuntimeTabId = activeRuntimeTab?.id ?? null;

	return (
		<section style={{ maxWidth: "44rem", width: "100%" }}>
			<h1 style={{ margin: "0 0 0.75rem" }}>ADHD.ai Agent Monitor</h1>
			<p style={{ margin: "0 0 1rem", color: "#a1a1aa" }}>{health.summary}</p>
			<div style={tabListStyle}>
				{renderRuntimeTabs(
					runtimes,
					resolvedActiveRuntimeTabId,
					onRuntimeTabChange,
				)}
			</div>
			<div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
				<Button type="button" onClick={onToggleDetails}>
					{showDetails ? "Hide details" : "Show details"}
				</Button>
			</div>
			<div style={{ color: "#e4e4e7" }}>
				<p style={{ margin: "0 0 0.5rem" }}>Server status: {health.status}</p>
				<p style={{ margin: "0 0 0.5rem" }}>Runtime tabs: {runtimes.summary}</p>
				{showDetails ? (
					<RuntimeDetails activeRuntimeTab={activeRuntimeTab} />
				) : null}
			</div>
		</section>
	);
}

function renderRuntimeTabs(
	runtimes: AgentRuntimeTabsViewModel,
	activeRuntimeTabId: string | null,
	onRuntimeTabChange: (tabId: string) => void,
): ReactElement {
	if (runtimes.status !== "ready") {
		return (
			<Button
				className="grid h-auto min-w-[8.5rem] justify-start gap-1 text-left text-zinc-400"
				type="button"
				disabled
				variant="outline"
			>
				<span style={tabLabelStyle}>{runtimes.summary}</span>
			</Button>
		);
	}

	return (
		<>
			{runtimes.tabs.map((tab) => {
				const isActive = activeRuntimeTabId === tab.id;
				return (
					<Button
						key={tab.id}
						type="button"
						onClick={() => onRuntimeTabChange(tab.id)}
						aria-pressed={isActive}
						className={`grid h-auto min-w-[8.5rem] justify-start gap-1 text-left ${
							isActive ? "border-blue-400 bg-zinc-800" : ""
						}`}
						variant="outline"
					>
						<span style={tabNameStyle}>{tab.name}</span>
						<span style={tabLabelStyle}>{tab.runtimeLabel}</span>
					</Button>
				);
			})}
		</>
	);
}

function RuntimeDetails({
	activeRuntimeTab,
}: {
	activeRuntimeTab: AgentRuntimeTabViewModel | null;
}): ReactElement {
	if (!activeRuntimeTab) {
		return <p style={{ margin: 0 }}>Active runtime: none</p>;
	}

	return (
		<p style={{ margin: 0 }}>
			Active runtime: <strong>{activeRuntimeTab.runtimeLabel}</strong>
			{" · "}
			Model: <strong>{activeRuntimeTab.model}</strong>
		</p>
	);
}

const tabListStyle = {
	display: "flex",
	flexWrap: "wrap",
	gap: "0.5rem",
	marginBottom: "1rem",
} as const;

const tabNameStyle = {
	fontSize: "0.78rem",
	lineHeight: 1.2,
	color: "#a1a1aa",
	overflowWrap: "anywhere",
} as const;

const tabLabelStyle = {
	fontSize: "0.95rem",
	fontWeight: 700,
	lineHeight: 1.2,
	overflowWrap: "anywhere",
} as const;
