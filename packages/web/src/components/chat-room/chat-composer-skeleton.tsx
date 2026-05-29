"use client";

import type { ReactElement } from "react";

import { Skeleton } from "@/components/loading/skeleton";

export function ChatComposerSkeleton(): ReactElement {
	return (
		<div aria-hidden="true" className="px-4 py-3">
			<div className="relative mx-auto max-w-4xl">
				<div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-2 rounded-md border border-border bg-surface-input p-2">
					<Skeleton className="h-10 w-10" />
					<div className="grid min-h-10 items-center gap-2 px-1 py-2">
						<Skeleton className="h-4 w-52 max-w-full" />
					</div>
					<Skeleton className="h-10 w-10" />
				</div>
			</div>
		</div>
	);
}
