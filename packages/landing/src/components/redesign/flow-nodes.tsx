import type { LucideIcon } from "lucide-react";
import type { ReactElement } from "react";

import { flowStages } from "@/components/redesign/flow-data";

export function FlowNode({
	big,
	color,
	icon: Icon,
	label,
	sub,
}: {
	big?: boolean;
	color?: "pink" | "cyan";
	icon: LucideIcon;
	label: string;
	sub?: string;
}): ReactElement {
	const bg =
		color === "pink"
			? "var(--neon-pink)"
			: color === "cyan"
				? "var(--neon-cyan)"
				: "var(--card)";

	return (
		<div
			className={`relative inline-flex items-center gap-2.5 border-2 border-foreground shadow-[3px_3px_0_0_var(--foreground)] ${
				big ? "px-5 py-3" : "px-3 py-2"
			}`}
			style={{ background: bg, minWidth: big ? 220 : 170 }}
		>
			<div
				className={`${big ? "h-8 w-8" : "h-6 w-6"} flex shrink-0 items-center justify-center bg-foreground text-background`}
			>
				<Icon className={big ? "h-4 w-4" : "h-3.5 w-3.5"} strokeWidth={2} />
			</div>
			<div className="min-w-0">
				<div
					className={`font-pixel uppercase leading-none ${big ? "text-xl" : "text-base"}`}
				>
					{label}
				</div>
				{sub ? (
					<div className="mt-0.5 truncate font-mono text-[10px] text-foreground/70">
						{sub}
					</div>
				) : null}
			</div>
		</div>
	);
}

export function Connector(): ReactElement {
	return (
		<div className="flex justify-center">
			<div
				className="h-6 w-0.5 bg-foreground"
				style={{
					backgroundImage:
						"linear-gradient(to bottom, var(--foreground) 50%, transparent 50%)",
					backgroundSize: "100% 6px",
				}}
			/>
		</div>
	);
}

export function PipelineRow(): ReactElement {
	return (
		<div className="flex flex-wrap items-stretch justify-center gap-0 border-2 border-foreground bg-background shadow-[3px_3px_0_0_var(--foreground)]">
			{flowStages.map((stage, index) => {
				const Icon = stage.icon;

				return (
					<div
						className={`flex items-center gap-1.5 px-2.5 py-2 sm:px-3 ${index > 0 ? "border-foreground border-l-2" : ""}`}
						key={stage.key}
						style={{
							background: index % 2 ? "var(--neon-cyan)" : "var(--neon-pink)",
						}}
					>
						<Icon className="h-3.5 w-3.5" strokeWidth={2} />
						<span className="font-pixel text-sm">{stage.label}</span>
					</div>
				);
			})}
		</div>
	);
}
