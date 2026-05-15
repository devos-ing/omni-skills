"use client";

import type { ReactElement } from "react";

import type {
	AgentHealthViewModel,
	AgentRuntimeTabViewModel,
	AgentRuntimeTabsViewModel,
} from "@/lib/agents/agent-monitor.types";

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
				<button type="button" onClick={onToggleDetails} style={buttonStyle}>
					{showDetails ? "Hide details" : "Show details"}
				</button>
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
			<button type="button" disabled style={disabledTabStyle}>
				<span style={tabLabelStyle}>{runtimes.summary}</span>
			</button>
		);
	}

	return (
		<>
			{runtimes.tabs.map((tab) => {
				const isActive = activeRuntimeTabId === tab.id;
				return (
					<button
						key={tab.id}
						type="button"
						onClick={() => onRuntimeTabChange(tab.id)}
						aria-pressed={isActive}
						style={isActive ? activeTabStyle : runtimeTabStyle}
					>
						<span style={tabNameStyle}>{tab.name}</span>
						<span style={tabLabelStyle}>{tab.runtimeLabel}</span>
					</button>
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

const buttonStyle = {
	border: "1px solid #3f3f46",
	borderRadius: "6px",
	background: "#27272a",
	color: "#f4f4f5",
	cursor: "pointer",
	padding: "0.5rem 0.75rem",
} as const;

const runtimeTabStyle = {
	...buttonStyle,
	display: "grid",
	gap: "0.2rem",
	minWidth: "8.5rem",
	textAlign: "left",
} as const;

const activeTabStyle = {
	...runtimeTabStyle,
	borderColor: "#60a5fa",
	background: "#1f2937",
} as const;

const disabledTabStyle = {
	...runtimeTabStyle,
	color: "#a1a1aa",
	cursor: "default",
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
