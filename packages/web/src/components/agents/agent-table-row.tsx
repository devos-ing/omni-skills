import { Bot, Cpu, Pencil } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Typography } from "@/components/ui/typography";

import type { AgentRowViewModel } from "./types/agent-list.types";

export function AgentTableRow({
	onEdit,
	row,
}: {
	onEdit: () => void;
	row: AgentRowViewModel;
}): ReactElement {
	return (
		<tr className="border-b border-border/70 hover:bg-surface-hover/50">
			<td className="px-4 py-4">
				<div className="flex min-w-0 items-center gap-3">
					<div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-surface-input">
						<Bot className="text-zinc-400" size={18} />
					</div>
					<div className="min-w-0">
						<Typography className="truncate text-base text-zinc-100">
							{row.name}
						</Typography>
						<Typography className="truncate italic text-zinc-500">
							{row.description || row.owner}
						</Typography>
					</div>
				</div>
			</td>
			<td className="px-3 py-4">
				<span className="inline-flex items-center gap-2 text-sm text-zinc-300">
					<span className={`h-2.5 w-2.5 rounded-full ${row.statusTone}`} />
					{row.statusLabel}
				</span>
			</td>
			<td className="px-3 py-4 text-sm text-zinc-300">{row.workloadLabel}</td>
			<td className="px-3 py-4">
				<span className="inline-flex min-w-0 items-center gap-2 text-sm text-zinc-300">
					<Cpu className="shrink-0 text-zinc-500" size={16} />
					<span className="truncate">{row.runtimeLabel}</span>
				</span>
			</td>
			<td className="px-3 py-4 text-sm text-zinc-400">
				<span className="block truncate">{row.activityLabel}</span>
			</td>
			<td className="px-3 py-4 text-right text-sm text-zinc-200">
				{row.runCount}
			</td>
			<td className="px-3 py-4">
				<Typography className="truncate text-sm text-zinc-200">
					{row.modelLabel}
				</Typography>
				<Typography className="truncate text-xs text-zinc-500">
					{row.reasoningLabel}
				</Typography>
			</td>
			<td className="px-3 py-4 text-right">
				<Button
					aria-label={`Edit ${row.name} model`}
					onClick={onEdit}
					size="icon"
					title="Edit model"
					type="button"
					variant="ghost"
				>
					<Pencil size={16} />
				</Button>
			</td>
		</tr>
	);
}
