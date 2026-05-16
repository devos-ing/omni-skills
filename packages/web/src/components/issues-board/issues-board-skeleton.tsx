import type { ReactElement } from "react";

import { Skeleton } from "@/components/loading/skeleton";

const skeletonColumns = [
	{ key: "primary", className: "block" },
	{ key: "secondary", className: "hidden md:block" },
	{ key: "tertiary", className: "hidden xl:block" },
] as const;
const skeletonCardKeys = ["a", "b", "c", "d"] as const;

export function IssuesBoardSkeleton(): ReactElement {
	return (
		<div className="flex h-[calc(100dvh-10.5rem)] gap-4 overflow-x-auto px-5 py-4">
			{skeletonColumns.map((column) => (
				<section
					className={`h-full w-[min(20rem,calc(100vw-2.5rem))] shrink-0 rounded-lg border border-zinc-800 bg-[#17181c] p-3 md:w-[20rem] ${column.className}`}
					key={column.key}
				>
					<header className="mb-4 flex items-center justify-between gap-3">
						<div className="flex items-center gap-2">
							<Skeleton className="h-4 w-4 rounded-full" />
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-4 w-6" />
						</div>
						<div className="flex items-center gap-2">
							<Skeleton className="h-8 w-8" />
							<Skeleton className="h-8 w-8" />
						</div>
					</header>
					<div className="grid content-start gap-3">
						{skeletonCardKeys.map((cardKey) => (
							<div
								className="rounded-lg border border-zinc-800 bg-[#1b1c21] p-3"
								key={cardKey}
							>
								<Skeleton className="mb-2 h-3 w-16" />
								<Skeleton className="h-4 w-full" />
								<Skeleton className="mt-2 h-4 w-5/6" />
								<Skeleton className="mb-3 mt-3 h-8 w-full" />
								<div className="flex gap-2">
									<Skeleton className="h-6 w-14" />
									<Skeleton className="h-6 w-20" />
									<Skeleton className="h-6 w-6" />
								</div>
							</div>
						))}
					</div>
				</section>
			))}
		</div>
	);
}
