import type { ReactElement } from "react";

const metrics = [
	{ value: "10M+", label: "Agent runs per day" },
	{ value: "<80ms", label: "Cold start, p95" },
	{ value: "99.99%", label: "Runtime uptime" },
	{ value: "200+", label: "Native integrations" },
];

export function Metrics(): ReactElement {
	return (
		<section className="border-foreground border-y-2 bg-[var(--neon-yellow)] py-16">
			<div className="mx-auto grid max-w-7xl grid-cols-2 gap-y-6 px-4 sm:px-6 md:grid-cols-4">
				{metrics.map((metric) => (
					<div className="px-2 text-center sm:px-4" key={metric.label}>
						<div className="font-pixel text-[clamp(2rem,5vw,4rem)] text-[var(--neon-purple)] leading-none">
							{metric.value}
						</div>
						<div className="mt-2 font-mono text-[10px] uppercase tracking-[0.15em] sm:text-xs sm:tracking-[0.2em]">
							{metric.label}
						</div>
					</div>
				))}
			</div>
		</section>
	);
}
