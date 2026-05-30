import type { ReactElement } from "react";

import { Typography } from "@/components/ui/typography";

export function AgentStatePanel({
	message,
	title,
	tone = "default",
}: {
	message: string;
	title: string;
	tone?: "default" | "error";
}): ReactElement {
	return (
		<section
			className={`grid gap-2 rounded-lg border p-4 ${
				tone === "error"
					? "border-red-900/50 bg-red-950/20"
					: "border-border bg-card"
			}`}
		>
			<Typography className="text-zinc-200" variant="sectionTitle">
				{title}
			</Typography>
			<Typography
				className={tone === "error" ? "text-red-100" : undefined}
				variant={tone === "error" ? "error" : "description"}
			>
				{message}
			</Typography>
		</section>
	);
}
