import type { ReactElement } from "react";

import type { WebOperatorLayoutProps } from "./types/web-operator-layout.types";

export function WebOperatorLayout({
	children,
	mobileSidebarTrigger,
	overlays,
	sidebar,
}: WebOperatorLayoutProps): ReactElement {
	return (
		<main className="relative grid h-[100dvh] max-h-[100dvh] min-w-0 grid-rows-[minmax(0,1fr)] overflow-x-clip bg-background md:grid-cols-[auto_minmax(0,1fr)]">
			{sidebar}
			{mobileSidebarTrigger}
			<div className="min-h-0 min-w-0">{children}</div>
			{overlays}
		</main>
	);
}
