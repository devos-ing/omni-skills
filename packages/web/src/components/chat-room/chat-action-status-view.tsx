"use client";

import type { ReactElement } from "react";

import { Typography } from "@/components/ui/typography";
import { ChatMissionProgress } from "./chat-mission-progress";
import { ChatMissionProgressSkeleton } from "./chat-mission-progress-skeleton";
import type { ChatActionStatusViewProps } from "./types/chat-room.types";

export function ChatActionStatusView({
	missionProgress,
	showMissionSkeleton,
}: ChatActionStatusViewProps): ReactElement {
	return (
		<section
			aria-label="Action"
			className="min-h-0 overflow-y-auto overflow-x-hidden px-4 py-5 md:px-6"
		>
			<div className="mx-auto grid w-full max-w-6xl min-w-0 gap-5">
				{showMissionSkeleton ? (
					<ChatMissionProgressSkeleton />
				) : missionProgress ? (
					<ChatMissionProgress mission={missionProgress} />
				) : (
					<ActionStatusEmpty />
				)}
			</div>
		</section>
	);
}

function ActionStatusEmpty(): ReactElement {
	return (
		<div className="grid min-h-64 place-items-center rounded-lg border border-border bg-card text-sm text-muted-foreground">
			<Typography variant="description">No mission status yet</Typography>
		</div>
	);
}
