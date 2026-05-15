"use client";

import { type ReactElement, useState } from "react";

type RunCommandCopyButtonProps = {
	command: string;
};

export function RunCommandCopyButton({
	command,
}: RunCommandCopyButtonProps): ReactElement {
	const [copied, setCopied] = useState(false);

	async function copyCommand(): Promise<void> {
		try {
			await navigator.clipboard.writeText(command);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1600);
		} catch {
			setCopied(false);
		}
	}

	return (
		<button
			aria-label="Copy setup command"
			className="border-2 border-white/18 bg-white/8 px-3 py-2 font-mono text-[11px] font-black uppercase tracking-[0.18em] text-white transition hover:border-circuit hover:text-circuit focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-circuit"
			onClick={() => void copyCommand()}
			type="button"
		>
			{copied ? "Copied" : "Copy"}
		</button>
	);
}
