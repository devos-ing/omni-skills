import type { HTMLAttributes, ReactElement } from "react";

import { cn } from "@/lib/utils";

function Skeleton({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>): ReactElement {
	return (
		<div
			className={cn("animate-pulse rounded-md bg-zinc-800/80", className)}
			{...props}
		/>
	);
}

export { Skeleton };
