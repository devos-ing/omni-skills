"use client";
import { Check, Copy, TerminalSquare } from "lucide-react";
import { useState } from "react";

const INSTALL_CMD = "curl -fsSL https://devos.ing/cli | sh";

function Dot({ c }: { c: string }) {
	return (
		<span
			className="w-3 h-3 border-2 border-background"
			style={{ background: c }}
		/>
	);
}

export default function InstallBlock() {
	const [copied, setCopied] = useState(false);
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(INSTALL_CMD);
			setCopied(true);
			setTimeout(() => setCopied(false), 1400);
		} catch {
			/* noop */
		}
	};
	return (
		<div className="border-2 border-foreground bg-foreground text-background text-left">
			<div className="flex items-center justify-between px-4 py-2 border-b-2 border-background/30">
				<div className="flex items-center gap-2 font-pixel text-[var(--neon-cyan)] text-sm tracking-widest">
					<TerminalSquare className="w-4 h-4" /> ~/INSTALL.SH
				</div>
				<div className="flex gap-1.5">
					<Dot c="var(--neon-pink)" />
					<Dot c="var(--neon-cyan)" />
					<Dot c="#ffea00" />
				</div>
			</div>
			<div className="flex items-stretch">
				<pre className="flex-1 font-mono text-sm sm:text-lg px-4 sm:px-5 py-4 sm:py-5 overflow-x-auto">
					<span className="text-[var(--neon-cyan)]">$ </span>
					{INSTALL_CMD}
					<span className="ml-1 inline-block w-2 h-4 align-middle bg-[var(--neon-pink)]" />
				</pre>
				{/* biome-ignore lint/a11y/useButtonType: <explanation> */}
				<button
					onClick={copy}
					className="shrink-0 px-4 sm:px-6 border-l-2 border-background/30 bg-[var(--neon-pink)] text-foreground font-pixel tracking-widest hover:bg-[var(--neon-cyan)] transition-colors flex items-center gap-2"
				>
					{copied ? (
						<Check className="w-4 h-4" />
					) : (
						<Copy className="w-4 h-4" />
					)}
					{copied ? "COPIED" : "COPY"}
				</button>
			</div>
		</div>
	);
}
