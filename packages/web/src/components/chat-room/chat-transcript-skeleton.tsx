"use client";

import type { ReactElement } from "react";

import { Skeleton } from "@/components/loading/skeleton";

export function ChatTranscriptSkeleton(): ReactElement {
	return (
		<output className="grid gap-4" aria-label="Loading conversation">
			<AssistantMessageSkeleton />
			<UserMessageSkeleton />
			<AssistantMessageSkeleton />
		</output>
	);
}

function AssistantMessageSkeleton(): ReactElement {
	return (
		<div className="grid max-w-[min(42rem,90%)] justify-self-start gap-2 rounded-md border border-border bg-surface-panel px-3 py-3">
			<Skeleton className="h-4 w-56 max-w-full" />
			<Skeleton className="h-4 w-80 max-w-full" />
			<Skeleton className="h-4 w-44 max-w-full" />
		</div>
	);
}

function UserMessageSkeleton(): ReactElement {
	return (
		<div className="grid max-w-[min(36rem,86%)] justify-self-end gap-2 rounded-md border border-zinc-700 bg-surface-active px-3 py-3">
			<Skeleton className="h-4 w-64 max-w-full" />
			<Skeleton className="h-4 w-40 max-w-full" />
		</div>
	);
}
