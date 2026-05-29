import type { ReactElement } from "react";

import { AgentMonitorShell } from "@/components/agent-monitor/agent-monitor-shell";
import { SettingsModelsPanel } from "@/components/settings/settings-models-panel";
import { TaskCreatePanel } from "@/components/task-create/task-create-panel";
import { Typography } from "@/components/ui/typography";

import type { SidebarNavKey } from "./types/web-shell.types";
import { sectionContentByKey } from "./web-shell.constants";

export function OperatorSectionPanel({
	sectionKey,
}: {
	sectionKey: SidebarNavKey;
}): ReactElement {
	const content = sectionContentByKey[sectionKey];

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
					border: "1px solid hsl(var(--border))",
					borderRadius: "8px",
					background: "hsl(var(--card))",
					color: "#f4f4f5",
					padding: "1rem",
				}}
			>
				<Typography className="mb-[0.45rem]" variant="pageTitle">
					{content.heading}
				</Typography>
				<Typography variant="description">{content.description}</Typography>
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
				{sectionKey === "settings" ? (
					<SettingsModelsPanel />
				) : (
					<>
						<TaskCreatePanel />
						<AgentMonitorShell />
					</>
				)}
			</div>
		</section>
	);
}
