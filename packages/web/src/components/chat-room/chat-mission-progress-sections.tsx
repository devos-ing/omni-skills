"use client";

import { ExternalLink, GitPullRequest } from "lucide-react";
import type { ReactElement } from "react";

import { Typography } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import { MissionStatusIcon } from "./chat-mission-progress-status-icon";
import { MissionUsageSummary } from "./chat-mission-usage-summary";
import type {
	ChatMissionDeliveryItem,
	ChatMissionPhase,
	ChatMissionProgressViewModel,
} from "./types/chat-mission-progress.types";

export function MissionBody({
	mission,
}: {
	mission: ChatMissionProgressViewModel;
}): ReactElement {
	return (
		<div className="grid gap-3">
			<MissionHeader mission={mission} />
			<MissionUsageSummary mission={mission} />
			<MissionDeliverySummary items={mission.deliveryItems} />
			<WorkflowPhases phases={mission.phases} />
		</div>
	);
}

function MissionDeliverySummary({
	items,
}: {
	items: ChatMissionDeliveryItem[];
}): ReactElement | null {
	if (items.length === 0) return null;
	return (
		<div className="grid gap-2 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
			{items.map((item) => (
				<DeliveryItem item={item} key={item.id} />
			))}
		</div>
	);
}

function DeliveryItem({
	item,
}: {
	item: ChatMissionDeliveryItem;
}): ReactElement {
	return (
		<div className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-border bg-surface-panel px-3 py-2">
			<div className="flex min-w-0 items-center gap-2">
				{item.id === "pullRequest" ? (
					<GitPullRequest
						aria-hidden="true"
						className="shrink-0 text-emerald-300"
						size={16}
					/>
				) : (
					<MissionStatusIcon status={item.tone} />
				)}
				<Typography className="truncate" variant="metadata">
					{item.label}
				</Typography>
			</div>
			{item.href ? (
				<a
					className="flex min-w-0 items-center gap-1 text-sm text-primary transition-colors hover:text-primary/80"
					href={item.href}
					rel="noreferrer"
					target="_blank"
				>
					<span className="truncate">{item.value}</span>
					<ExternalLink aria-hidden="true" className="shrink-0" size={14} />
				</a>
			) : (
				<Typography className="shrink-0" variant="metadata">
					{item.value}
				</Typography>
			)}
		</div>
	);
}

function MissionHeader({
	mission,
}: {
	mission: ChatMissionProgressViewModel;
}): ReactElement {
	return (
		<header className="flex flex-wrap items-start justify-between gap-3">
			<div className="min-w-0">
				<Typography className="text-muted-foreground" variant="eyebrow">
					Mission
				</Typography>
				<Typography className="mt-1 truncate" variant="sectionTitle">
					{mission.title.trim() || "Untitled task"}
				</Typography>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				{mission.taskKey ? (
					<Typography
						className="rounded-sm border border-border bg-surface-inset px-2 py-1"
						variant="metadata"
					>
						{mission.taskKey}
					</Typography>
				) : null}
				<Typography
					className="rounded-sm border border-border bg-surface-inset px-2 py-1"
					variant="metadata"
				>
					{mission.statusLabel}
				</Typography>
			</div>
		</header>
	);
}

function WorkflowPhases({
	phases,
}: { phases: ChatMissionPhase[] }): ReactElement {
	return (
		<div
			className="grid gap-2 sm:grid-cols-[repeat(3,minmax(0,1fr))]"
			data-mission-workflow="true"
		>
			{phases.map((phase, index) => (
				<PhaseNode isFirst={index === 0} key={phase.id} phase={phase} />
			))}
		</div>
	);
}

function PhaseNode({
	isFirst,
	phase,
}: {
	isFirst: boolean;
	phase: ChatMissionPhase;
}): ReactElement {
	return (
		<div
			className={cn(
				"relative grid min-h-20 gap-2 rounded-md border bg-surface-panel px-3 py-2 text-left",
				phase.status === "success" && "border-emerald-900/70",
				phase.status === "failed" && "border-red-900/70 bg-red-950/20",
				phase.status === "running" && "border-sky-900/70",
				phase.status === "warning" && "border-amber-900/70",
				phase.status === "pending" && "border-border",
				!isFirst &&
					"before:absolute before:-left-2 before:top-1/2 before:hidden before:h-px before:w-2 before:bg-border sm:before:block",
			)}
			data-mission-phase={phase.id}
			data-mission-phase-status={phase.status}
		>
			<div className="flex items-center gap-2">
				<MissionStatusIcon status={phase.status} />
				<Typography className="min-w-0 truncate" variant="cardTitle">
					{phase.label}
				</Typography>
			</div>
			<Typography className="capitalize text-muted-foreground" variant="muted">
				{phase.status}
			</Typography>
		</div>
	);
}
