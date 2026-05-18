import { ArrowRight } from "lucide-react";
import type { ReactElement } from "react";

export function CTA(): ReactElement {
	return (
		<section className="py-16 sm:py-24 md:py-32" id="docs">
			<div className="mx-auto max-w-5xl px-4 sm:px-6">
				<div className="relative overflow-hidden border-2 border-foreground bg-foreground p-8 text-center text-background shadow-retro-pink sm:p-12 md:p-20">
					<div
						className="pointer-events-none absolute inset-0 opacity-[0.06]"
						style={{
							backgroundImage:
								"linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
							backgroundSize: "40px 40px",
						}}
					/>
					<h2 className="mx-auto max-w-2xl font-pixel text-[clamp(2.5rem,6vw,5rem)] uppercase leading-none">
						<span className="text-[var(--neon-pink)] text-glow-pink">
							Give your team
						</span>
						<br />
						<span className="text-[var(--neon-cyan)] text-glow-cyan">
							a thousand teammates.
						</span>
					</h2>
					<p className="mx-auto mt-5 max-w-md text-background/70">
						Runs on your machine. Your code, your keys, your control.
					</p>
					<div className="mt-10 flex flex-wrap justify-center gap-4">
						<a
							className="inline-flex items-center gap-2 border-2 border-background bg-[var(--neon-yellow)] px-6 py-3 text-foreground shadow-[6px_6px_0_0_var(--neon-pink)] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5"
							href="#start"
						>
							{"\u25BA"} npx devos onboard
							<ArrowRight className="h-4 w-4" />
						</a>
						<a
							className="inline-flex items-center gap-2 border-2 border-background bg-background px-6 py-3 text-foreground shadow-[6px_6px_0_0_var(--neon-cyan)] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5"
							href="#docs"
						>
							READ THE DOCS
						</a>
					</div>
				</div>
			</div>
		</section>
	);
}
