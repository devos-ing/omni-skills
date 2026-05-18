import { ArrowRight, Play } from "lucide-react";
import type { ReactElement } from "react";

import { FloatingDecor } from "@/components/redesign/hero-illustrations";
import { ProductPreview } from "@/components/redesign/product-preview";

export function Hero(): ReactElement {
	return (
		<section className="relative overflow-hidden border-foreground border-b-2">
			<SunsetBackdrop />
			<FloatingDecor />
			<div className="relative mx-auto max-w-7xl px-4 pt-12 pb-16 sm:px-6 md:pt-20 md:pb-24">
				<div className="mb-6 flex justify-center px-2">
					<a
						className="inline-flex max-w-full items-center gap-2 border-2 border-foreground bg-[var(--neon-yellow)] py-1 pr-2 pl-1 text-[10px] shadow-retro-sm sm:pr-3 sm:text-xs"
						href="#start"
					>
						<span className="shrink-0 bg-foreground px-2 py-0.5 font-mono text-[var(--neon-yellow)] text-[10px] tracking-widest">
							NEW
						</span>
						<span className="truncate font-mono">v0.0.1 - EARLY ACCESS</span>
						<ArrowRight className="h-3 w-3 shrink-0" />
					</a>
				</div>
				<h1 className="mx-auto max-w-3xl break-words text-center font-pixel text-[clamp(1.75rem,5.5vw,3.75rem)] uppercase leading-none tracking-tight">
					<span className="text-[var(--neon-pink)] text-glow-pink">
						Code is cheap,
					</span>{" "}
					show me your{" "}
					<span className="text-[var(--neon-cyan)] text-glow-cyan">
						agentic system.
					</span>
				</h1>
				<p className="mx-auto mt-4 max-w-xl px-2 text-center text-foreground/80 text-sm leading-relaxed sm:mt-5 sm:text-base">
					devos.ing is the agentic workflow OS. Manage every task on a project
					board, watch your agents run the loop, and stay in sync from Telegram
					- wherever you are.
				</p>
				<div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:mt-10 sm:gap-4">
					<a
						className="group inline-flex items-center gap-2 border-2 border-foreground bg-[var(--neon-pink)] px-4 py-2.5 text-foreground text-sm shadow-retro transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[8px_8px_0_0_var(--foreground)] active:translate-x-0 active:translate-y-0 active:shadow-[2px_2px_0_0_var(--foreground)] sm:px-6 sm:py-3 sm:text-base"
						href="https://github.com/1997roylee/devos.ing"
						rel="noopener noreferrer"
						target="_blank"
					>
						{"\u25BA"} RUN LOCALLY
						<ArrowRight className="h-4 w-4" />
					</a>
					<a
						className="inline-flex items-center gap-2 border-2 border-foreground bg-[var(--neon-cyan)] px-4 py-2.5 text-foreground text-sm shadow-retro transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[8px_8px_0_0_var(--foreground)] sm:px-6 sm:py-3 sm:text-base"
						href="#platform"
					>
						<Play className="h-3.5 w-3.5 fill-current" />
						WATCH DEMO
					</a>
				</div>
				<p className="mt-6 px-2 text-center font-mono text-[10px] text-foreground/60 tracking-wider sm:text-xs">
					{"\u2605"} RUNS LOCALLY {"\u2605"} YOUR MACHINE {"\u2605"} YOUR KEYS{" "}
					{"\u2605"}
				</p>
				<div className="mt-12 sm:mt-20">
					<ProductPreview />
				</div>
			</div>
		</section>
	);
}

function SunsetBackdrop(): ReactElement {
	return (
		<div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
			<div
				className="-translate-x-1/2 absolute top-32 left-1/2 h-[640px] w-[640px] rounded-full"
				style={{
					background:
						"radial-gradient(circle, var(--neon-yellow) 0%, var(--neon-pink) 45%, var(--neon-purple) 75%, transparent 80%)",
					filter: "blur(8px)",
					opacity: 0.35,
				}}
			/>
			<div className="-translate-x-1/2 absolute top-[420px] left-1/2 flex w-[600px] flex-col gap-2 opacity-70">
				{[3, 5, 7, 10, 14, 20].map((height, index) => (
					<div
						key={height}
						style={{
							background: "var(--foreground)",
							height,
							opacity: 1 - index * 0.12,
						}}
					/>
				))}
			</div>
			<div
				className="absolute right-0 bottom-0 left-0 h-[260px]"
				style={{
					backgroundImage:
						"linear-gradient(to bottom, transparent 0%, rgba(176,38,255,0.18) 100%), repeating-linear-gradient(0deg, transparent, transparent 30px, var(--neon-purple) 30px, var(--neon-purple) 31px), repeating-linear-gradient(90deg, transparent, transparent 40px, var(--neon-purple) 40px, var(--neon-purple) 41px)",
					opacity: 0.35,
					transform: "perspective(280px) rotateX(50deg)",
					transformOrigin: "bottom",
				}}
			/>
			<div className="absolute inset-0 scanlines opacity-50" />
		</div>
	);
}
