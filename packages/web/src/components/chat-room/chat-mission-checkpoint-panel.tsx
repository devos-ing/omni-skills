"use client";

import { ListChecks } from "lucide-react";
import type { ReactElement } from "react";

import { Typography } from "@/components/ui/typography";

import { MissionStatusIcon } from "./chat-mission-progress-status-icon";
import type { ChatMissionCheckpoint } from "./types/chat-mission-progress.types";

export function MissionCheckpointPanel({
	checkpoints,
	phaseLabel,
}: {
	checkpoints: ChatMissionCheckpoint[];
	phaseLabel: string;
}): ReactElement {
	return (
		<section
			className="grid gap-2 rounded-md border border-border bg-surface-inset px-3 py-2"
			data-mission-checkpoints-panel="true"
		>
			<div className="flex items-center gap-2 text-muted-foreground">
				<ListChecks size={14} />
				<Typography variant="eyebrow">{phaseLabel} progress</Typography>
			</div>
			<div className="grid gap-1">
				{checkpoints.length > 0 ? (
					checkpoints.map((checkpoint) => (
						<CheckpointRow checkpoint={checkpoint} key={checkpoint.id} />
					))
				) : (
					<Typography className="text-muted-foreground" variant="mono">
						No progress recorded for this stage.
					</Typography>
				)}
			</div>
		</section>
	);
}

function CheckpointRow({
	checkpoint,
}: {
	checkpoint: ChatMissionCheckpoint;
}): ReactElement {
	return (
		<div
			className="grid min-h-8 min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 overflow-hidden rounded-sm px-1.5 py-1"
			data-mission-checkpoint={checkpoint.id}
			data-mission-checkpoint-status={checkpoint.status}
		>
			<span>
				<MissionStatusIcon size={15} status={checkpoint.status} />
			</span>
			<Typography className="block min-w-0 flex-1 truncate" variant="muted">
				{checkpoint.label}
			</Typography>
			<Typography
				className="whitespace-nowrap capitalize text-muted-foreground"
				variant="metadata"
			>
				{formatProgressStatus(checkpoint.status)}
			</Typography>
		</div>
	);
}

function formatProgressStatus(status: ChatMissionCheckpoint["status"]): string {
	return status;
}
