"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ReactElement, useState } from "react";

import { crewBots } from "@/components/redesign/agents-crew-data";
import { PixelBot } from "@/components/redesign/agents-crew-pixel-bot";
import { Roster } from "@/components/redesign/agents-crew-roster";
import type {
	CornerPosition,
	CrewBot,
} from "@/components/redesign/redesign.types";

export function AgentsCrew(): ReactElement {
	const [index, setIndex] = useState(0);
	const bot = crewBots[index];
	const accent = index % 2 ? "var(--neon-cyan)" : "var(--neon-pink)";

	function prev(): void {
		setIndex((value) => (value - 1 + crewBots.length) % crewBots.length);
	}

	function next(): void {
		setIndex((value) => (value + 1) % crewBots.length);
	}

	return (
		<section
			className="relative overflow-hidden border-border/50 border-t py-16 sm:py-24 md:py-32"
			id="crew"
		>
			<div className="pointer-events-none absolute inset-0 scanlines opacity-30" />
			<div className="relative mx-auto max-w-7xl px-4 sm:px-6">
				<div className="mb-10 max-w-2xl sm:mb-14">
					<p className="mb-3 font-mono text-foreground/60 text-xs uppercase tracking-[0.2em]">
						{"\u2593"} MEET THE CREW {"\u2593"}
					</p>
					<h2 className="font-pixel text-[clamp(2.25rem,5vw,4rem)] uppercase leading-none">
						Five bots.{" "}
						<span className="text-[var(--neon-pink)]">One pipeline.</span>
					</h2>
					<p className="mt-5 max-w-md text-foreground/70 leading-relaxed">
						Each agent has one job. Pick one to read its dossier.
					</p>
				</div>
				<div className="grid items-stretch gap-6 sm:gap-8 lg:grid-cols-[1fr_1fr]">
					<FeaturedBot
						accent={accent}
						bot={bot}
						index={index}
						next={next}
						prev={prev}
					/>
					<Roster index={index} setIndex={setIndex} />
				</div>
			</div>
		</section>
	);
}

function FeaturedBot({
	accent,
	bot,
	index,
	next,
	prev,
}: {
	accent: string;
	bot: CrewBot;
	index: number;
	next: () => void;
	prev: () => void;
}): ReactElement {
	const Icon = bot.icon;

	return (
		<div className="relative overflow-hidden border-2 border-foreground bg-card shadow-retro">
			<div className="flex h-10 items-center justify-between border-foreground border-b-2 bg-foreground px-4 text-background">
				<div className="flex items-center gap-2 font-mono text-[10px] tracking-widest">
					<span className="h-2 w-2 animate-pulse bg-[var(--neon-cyan)]" />
					UNIT 0{index + 1} / {crewBots.length}
				</div>
				<div
					className="truncate font-mono text-[10px] tracking-widest"
					style={{ color: accent }}
				>
					{bot.name} / {bot.badge}
				</div>
				<div className="flex items-center gap-1">
					<button
						aria-label="Previous"
						className="grid h-6 w-6 place-items-center border border-background/40 transition hover:bg-background hover:text-foreground"
						onClick={prev}
						type="button"
					>
						<ChevronLeft className="h-3.5 w-3.5" />
					</button>
					<button
						aria-label="Next"
						className="grid h-6 w-6 place-items-center border border-background/40 transition hover:bg-background hover:text-foreground"
						onClick={next}
						type="button"
					>
						<ChevronRight className="h-3.5 w-3.5" />
					</button>
				</div>
			</div>
			<div
				className="relative aspect-[4/3] overflow-hidden sm:aspect-[5/4]"
				style={{
					background:
						"repeating-linear-gradient(0deg, transparent 0 8px, rgba(26,11,46,0.06) 8px 9px), repeating-linear-gradient(90deg, transparent 0 8px, rgba(26,11,46,0.06) 8px 9px), var(--background)",
				}}
			>
				<div
					className="absolute inset-0"
					style={{
						backgroundImage: `radial-gradient(circle at 50% 70%, ${accent}40, transparent 65%)`,
					}}
				/>
				<div className="pointer-events-none absolute inset-0 overflow-hidden">
					<div
						className="crew-sweep absolute right-0 left-0 h-12"
						style={{
							background: `linear-gradient(to bottom, transparent, ${accent}22, transparent)`,
						}}
					/>
				</div>
				{(["tl", "tr", "bl", "br"] as CornerPosition[]).map((position) => (
					<Corner color={accent} key={position} position={position} />
				))}
				<div className="absolute top-2 left-3 font-mono text-[9px] text-foreground/60 tracking-widest">
					ID:{bot.key.toUpperCase()}
				</div>
				<div className="absolute top-2 right-3 flex items-center gap-1 font-mono text-[9px] text-foreground/60">
					<span className="h-1.5 w-1.5 animate-pulse bg-[var(--neon-cyan)]" />
					ONLINE
				</div>
				<div
					className="crew-bob absolute inset-0 flex items-end justify-center pb-6"
					key={bot.key}
				>
					<PixelBot face={bot.face} variant={index} visor={bot.visor} />
				</div>
				<div
					className="pointer-events-none absolute inset-0 flex flex-col justify-end p-4 sm:p-5"
					style={{
						background:
							"linear-gradient(to top, rgba(26,11,46,0.92) 0%, rgba(26,11,46,0.72) 55%, transparent 100%)",
					}}
				>
					<div className="text-background" key={bot.key}>
						<div className="mb-1 flex items-center gap-2">
							<Icon
								className="h-4 w-4"
								strokeWidth={2}
								style={{ color: accent }}
							/>
							<span className="font-mono text-[10px] text-background/70 tracking-widest">
								DOSSIER / {bot.name}
							</span>
						</div>
						<div
							className="font-pixel text-2xl uppercase leading-none sm:text-3xl"
							style={{ color: accent }}
						>
							{bot.role}
						</div>
						<p className="mt-2 text-background/90 text-sm">{bot.tagline}</p>
						<p className="mt-2 max-w-md text-background/70 text-xs leading-relaxed">
							{bot.body}
						</p>
						<div className="mt-3 flex gap-4">
							{bot.stats.map((stat) => (
								<div className="font-mono" key={stat.label}>
									<div className="text-[9px] text-background/50 tracking-widest">
										{stat.label}
									</div>
									<div className="text-sm" style={{ color: accent }}>
										{stat.value}
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

function Corner({
	color,
	position,
}: {
	color: string;
	position: CornerPosition;
}): ReactElement {
	const classes: Record<CornerPosition, string> = {
		tl: "top-2 left-2 border-t-2 border-l-2",
		tr: "top-2 right-2 border-t-2 border-r-2",
		bl: "bottom-2 left-2 border-b-2 border-l-2",
		br: "right-2 bottom-2 border-r-2 border-b-2",
	};

	return (
		<div
			className={`absolute h-4 w-4 ${classes[position]}`}
			style={{ borderColor: color }}
		/>
	);
}
