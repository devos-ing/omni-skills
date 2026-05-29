"use client";

import type { ReactElement } from "react";

import { Skeleton } from "@/components/loading/skeleton";

import { missionPanelWidthClass } from "./chat-mission-progress";

export function ChatMissionProgressSkeleton(): ReactElement {
	return (
		<section
			aria-label="Loading mission progress"
			className={`${missionPanelWidthClass(false)} mx-auto z-20 grid w-full max-w-full justify-self-center gap-3 rounded-md border border-border bg-surface-input/95 px-3 py-3 backdrop-blur`}
			data-chat-mission-progress="true"
			data-chat-mission-progress-sticky="true"
		>
			<div className="flex justify-end">
				<Skeleton className="h-7 w-7" />
			</div>
			<div className="grid gap-3">
				<Skeleton className="h-4 w-36 max-w-full" />
				<div className="grid gap-2">
					<Skeleton className="h-3 w-full" />
					<Skeleton className="h-3 w-10/12" />
				</div>
				<div className="grid grid-cols-3 gap-2">
					<Skeleton className="h-8 w-full" />
					<Skeleton className="h-8 w-full" />
					<Skeleton className="h-8 w-full" />
				</div>
			</div>
		</section>
	);
}
