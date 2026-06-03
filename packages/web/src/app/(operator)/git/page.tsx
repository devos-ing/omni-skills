import type { ReactElement } from "react";

import { GitInstructionsPanel } from "@/components/git/git-instructions-panel";

export default function GitPage(): ReactElement {
	return (
		<section className="grid h-[100dvh] max-h-[100dvh] content-start gap-4 overflow-auto p-[clamp(0.75rem,3vw,1.25rem)]">
			<GitInstructionsPanel />
		</section>
	);
}
