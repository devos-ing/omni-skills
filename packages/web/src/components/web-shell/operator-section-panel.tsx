import type { ReactElement } from "react";

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
				<h1 style={{ fontSize: "1.35rem", fontWeight: 600 }}>
					{content.heading}
				</h1>
				<p style={{ color: "hsl(var(--muted-foreground))" }}>
					{content.description}
				</p>
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
				{/* <AgentMonitorShell /> */}
			</div>
		</section>
	);
}
