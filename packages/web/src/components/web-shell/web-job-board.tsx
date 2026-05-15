"use client";

import type { ReactElement } from "react";

import { AgentMonitorShell } from "@/components/agent-monitor/agent-monitor-shell";
import { AgentsPanel } from "@/components/agents/agents-panel";
import { IssuesBoard } from "@/components/issues-board/issues-board";
import { TaskCreatePanel } from "@/components/task-create/task-create-panel";
import type { SidebarNavItem } from "@/components/web-shell/web-shell.types";

interface WebJobBoardProps {
	activeKey: SidebarNavItem["key"];
	createIssueRequest: number;
}

const sectionDescriptions: Record<SidebarNavItem["key"], string> = {
	agents: "Monitor active agent health and workflow state.",
	runtimes: "Track runtime readiness and job execution surfaces.",
	skills: "Manage skill coverage needed for task execution.",
	settings: "Review operator-level defaults and preferences.",
	issues: "Inspect issue queue and active implementation flow.",
	projects: "Coordinate project-level work streams and status.",
	inbox: "Handle incoming task requests and clarifications.",
	autopilot: "Observe automation status and intervention needs.",
	squads: "Coordinate grouped agents and ownership boundaries.",
	usage: "Inspect workflow usage and operating volume.",
};

export function WebJobBoard({
	activeKey,
	createIssueRequest,
}: WebJobBoardProps): ReactElement {
	if (activeKey === "issues") {
		return <IssuesBoard createIssueRequest={createIssueRequest} />;
	}
	if (activeKey === "agents") {
		return (
			<section
				style={{
					padding: "clamp(0.75rem, 3vw, 1.25rem)",
					display: "grid",
					gap: "1rem",
					alignContent: "start",
					minHeight: "100vh",
					minWidth: 0,
				}}
			>
				<AgentsPanel />
			</section>
		);
	}

	const heading = activeKey.charAt(0).toUpperCase() + activeKey.slice(1);
	const description = sectionDescriptions[activeKey];

	return (
		<section
			style={{
				padding: "clamp(0.75rem, 3vw, 1.25rem)",
				display: "grid",
				gap: "1rem",
				alignContent: "start",
				height: "100dvh",
				maxHeight: "100dvh",
				minWidth: 0,
				overflow: "auto",
			}}
		>
			<header
				style={{
					border: "1px solid #27272a",
					borderRadius: "8px",
					background: "#18191d",
					color: "#f4f4f5",
					padding: "1rem",
				}}
			>
				<h1 style={{ margin: "0 0 0.45rem" }}>{heading} Job Board</h1>
				<p style={{ margin: 0, color: "#a1a1aa" }}>{description}</p>
			</header>
			<div
				style={{
					display: "grid",
					gap: "1rem",
					gridTemplateColumns:
						"repeat(auto-fit, minmax(min(100%, 20rem), 1fr))",
					minWidth: 0,
				}}
			>
				<TaskCreatePanel />
				<AgentMonitorShell />
			</div>
		</section>
	);
}
