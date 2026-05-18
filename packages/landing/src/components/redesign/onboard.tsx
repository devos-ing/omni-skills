"use client";

import { Check, Copy, Terminal } from "lucide-react";
import { type ReactElement, useState } from "react";

const command = "npx devos onboard";

export function Onboard(): ReactElement {
	const [copied, setCopied] = useState(false);

	function copy(): void {
		void navigator.clipboard?.writeText(command);
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1500);
	}

	return (
		<section
			className="border-foreground border-b-2 py-16 sm:py-20 md:py-28"
			id="start"
		>
			<div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
				<p className="mb-3 font-mono text-foreground/60 text-xs uppercase tracking-[0.2em]">
					{"\u2593"} GET STARTED {"\u2593"}
				</p>
				<h2 className="font-pixel text-[clamp(2rem,4.5vw,3.5rem)] uppercase leading-none">
					Run the command.
					<br />
					<span className="text-[var(--neon-pink)]">
						Onboard in 30 seconds.
					</span>
				</h2>
				<p className="mx-auto mt-5 max-w-xl text-foreground/70">
					One command bootstraps your workspace, links your repo, and spins up
					your first agent crew. No installs, no config files.
				</p>
				<button
					className="group mx-auto mt-10 flex w-full max-w-xl items-center gap-2 border-2 border-foreground bg-foreground px-3 py-3 text-left text-background shadow-retro-pink transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[8px_8px_0_0_var(--neon-pink)] active:translate-x-0 active:translate-y-0 sm:gap-3 sm:px-4 sm:py-4"
					onClick={copy}
					type="button"
				>
					<Terminal className="h-4 w-4 shrink-0 text-[var(--neon-cyan)] sm:h-5 sm:w-5" />
					<span className="flex-1 truncate font-mono text-sm sm:text-lg">
						<span className="text-[var(--neon-pink)]">$</span>{" "}
						<span className="text-background">{command}</span>
						<span className="ml-1 inline-block h-4 w-2 animate-pulse bg-[var(--neon-cyan)] align-middle" />
					</span>
					<span className="flex shrink-0 items-center gap-1 border border-background/30 px-1.5 py-1 text-[10px] text-background/70 uppercase tracking-wider transition group-hover:border-[var(--neon-cyan)] group-hover:text-[var(--neon-cyan)] sm:gap-1.5 sm:px-2 sm:text-xs">
						{copied ? (
							<Check className="h-3 w-3" />
						) : (
							<Copy className="h-3 w-3" />
						)}
						<span className="hidden sm:inline">
							{copied ? "Copied" : "Copy"}
						</span>
					</span>
				</button>
				<div className="mt-6 flex flex-wrap items-center justify-center gap-6 font-mono text-foreground/60 text-xs">
					<span>{"\u2713"} no install</span>
					<span>{"\u2713"} works with any repo</span>
					<span>{"\u2713"} runs on your machine</span>
				</div>
			</div>
		</section>
	);
}
