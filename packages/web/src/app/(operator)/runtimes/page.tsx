import type { ReactElement } from "react";

import { RuntimesPanel } from "@/components/runtimes/runtimes-panel";

export default function RuntimesPage(): ReactElement {
	return (
		<section className="grid h-[100dvh] max-h-[100dvh] content-start gap-4 overflow-auto p-[clamp(0.75rem,3vw,1.25rem)]">
			<header className="grid gap-1">
				<h1 className="m-0 text-xl font-semibold text-zinc-100">Runtimes</h1>
				<p className="m-0 text-sm text-zinc-500">
					Configured agent runtime coverage and capacity.
				</p>
			</header>
			<RuntimesPanel />
		</section>
	);
}
