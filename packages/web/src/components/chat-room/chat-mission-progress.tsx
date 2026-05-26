"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import { type ReactElement, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MissionBody } from "./chat-mission-progress-sections";
import type {
	ChatMissionLogLine,
	ChatMissionProgressViewModel,
} from "./types/chat-mission-progress.types";

export function missionPanelWidthClass(isExpanded: boolean): string {
	return isExpanded ? "max-w-6xl" : "max-w-4xl";
}

export function ChatMissionProgress({
	liveLogLines = [],
	mission,
}: {
	liveLogLines?: ChatMissionLogLine[];
	mission: ChatMissionProgressViewModel | null;
}): ReactElement | null {
	const [isExpanded, setIsExpanded] = useState(false);
	if (!mission) return null;
	const isLoading = mission.state === "loading";
	const isError = mission.state === "error";
	const expandLabel = isExpanded
		? "Collapse mission panel"
		: "Expand mission panel";
	const ExpandIcon = isExpanded ? Minimize2 : Maximize2;
	return (
		<section
			className={cn(
				"mx-auto z-20 grid w-full max-w-full justify-self-center gap-3 rounded-md border border-border bg-surface-input/95 px-3 py-3 text-sm text-zinc-300 backdrop-blur",
				missionPanelWidthClass(isExpanded),
			)}
			data-chat-mission-expanded={isExpanded ? "true" : "false"}
			data-chat-mission-progress="true"
			data-chat-mission-progress-sticky="true"
		>
			<div className="flex justify-end">
				<Button
					aria-label={expandLabel}
					aria-pressed={isExpanded}
					className="h-7 w-7"
					onClick={() => setIsExpanded((current) => !current)}
					size="icon"
					type="button"
					variant="ghost"
				>
					<ExpandIcon aria-hidden="true" size={15} />
				</Button>
			</div>
			{isLoading ? <MissionState label="Loading mission progress..." /> : null}
			{isError ? (
				<MissionState
					label={mission.errorMessage ?? "Mission progress unavailable."}
				/>
			) : null}
			{mission.state === "ready" ? (
				<MissionBody liveLogLines={liveLogLines} mission={mission} />
			) : null}
		</section>
	);
}

function MissionState({ label }: { label: string }): ReactElement {
	return <p className="m-0 text-sm text-muted-foreground">{label}</p>;
}
