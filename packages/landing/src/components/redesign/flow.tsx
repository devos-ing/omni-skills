import type { ReactElement } from "react";

import { flowSteps } from "@/components/redesign/flow-data";
import { FlowDiagram } from "@/components/redesign/flow-diagram";

export function Flow(): ReactElement {
	return (
		<section
			className="relative overflow-hidden border-border/50 border-t py-16 sm:py-24 md:py-32"
			id="flow"
		>
			<div className="pointer-events-none absolute inset-0 scanlines opacity-30" />
			<div className="relative mx-auto max-w-7xl px-4 sm:px-6">
				<div className="mb-12 max-w-2xl sm:mb-16">
					<p className="mb-3 font-mono text-foreground/60 text-xs uppercase tracking-[0.2em]">
						{"\u2593"} HOW IT WORKS {"\u2593"}
					</p>
					<h2 className="font-pixel text-[clamp(2.25rem,5vw,4rem)] uppercase leading-none">
						One flow.{" "}
						<span className="text-[var(--neon-pink)]">Five moving parts.</span>
					</h2>
					<p className="mt-5 max-w-md text-foreground/70 leading-relaxed">
						From a one-line idea to a merged PR - every step is wired up. You
						drop the work in, devos picks it up.
					</p>
				</div>
				<FlowDiagram />
				<ol className="mt-12 grid gap-4 md:grid-cols-2 sm:mt-16 lg:grid-cols-5">
					{flowSteps.map((step, index) => {
						const Icon = step.icon;

						return (
							<li
								className="border-2 border-foreground bg-card p-4 shadow-retro-sm"
								key={step.title}
								style={{
									borderTopColor:
										index % 2 ? "var(--neon-cyan)" : "var(--neon-pink)",
									borderTopWidth: 6,
								}}
							>
								<div className="mb-2 flex items-center gap-2">
									<span className="font-pixel text-xl">0{index + 1}</span>
									<Icon className="h-4 w-4" strokeWidth={2} />
								</div>
								<div className="font-pixel text-lg uppercase">{step.title}</div>
								<p className="mt-1.5 text-foreground/70 text-xs leading-relaxed">
									{step.body}
								</p>
							</li>
						);
					})}
				</ol>
			</div>
		</section>
	);
}
