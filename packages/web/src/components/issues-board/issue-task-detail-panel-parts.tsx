import { ChevronDown } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import { Typography } from "@/components/ui/typography";

import { formatTokenCount } from "./issue-task-detail-panel-utils";

export function PanelSection({
	children,
	title,
}: {
	children: ReactNode;
	title: string;
}): ReactElement {
	return (
		<details className="group grid gap-3" open>
			<Typography
				as="summary"
				className="flex cursor-pointer list-none items-center gap-2"
				variant="sectionTitle"
			>
				<span>{title}</span>
				<ChevronDown className="transition group-open:rotate-180" size={16} />
			</Typography>
			<div className="mt-3 grid gap-3">{children}</div>
		</details>
	);
}

export function PropertyRow({
	children,
	icon,
	label,
}: {
	children: ReactNode;
	icon: ReactElement;
	label: string;
}): ReactElement {
	return (
		<div className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3 text-sm">
			<Typography variant="description">{label}</Typography>
			<Typography
				as="span"
				className="flex min-w-0 items-center gap-2 break-words text-zinc-200"
			>
				<span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-active text-zinc-400">
					{icon}
				</span>
				<Typography as="span" className="min-w-0 break-words">
					{children}
				</Typography>
			</Typography>
		</div>
	);
}

export function MetricRow({
	label,
	value,
}: {
	label: string;
	value: number;
}): ReactElement {
	return (
		<div className="grid grid-cols-[5rem_1fr] gap-3 text-sm">
			<Typography variant="description">{label}</Typography>
			<Typography as="span" className="text-zinc-200" variant="cardTitle">
				{formatTokenCount(value)}
			</Typography>
		</div>
	);
}

export function PanelState({ label }: { label: string }): ReactElement {
	return (
		<div className="grid min-h-[24rem] place-items-center px-6 text-sm text-muted-foreground">
			<Typography variant="description">{label}</Typography>
		</div>
	);
}
