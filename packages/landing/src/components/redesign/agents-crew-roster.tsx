import type { ReactElement } from "react";

import { crewBots } from "@/components/redesign/agents-crew-data";
import { PixelBot } from "@/components/redesign/agents-crew-pixel-bot";
import type { CrewBot } from "@/components/redesign/redesign.types";

export function Roster({
	index,
	setIndex,
}: {
	index: number;
	setIndex: (index: number) => void;
}): ReactElement {
	return (
		<div className="flex flex-col">
			<div className="flex-1 border-2 border-foreground bg-card p-4 shadow-retro-sm sm:p-5">
				<div className="mb-3 font-mono text-[10px] text-foreground/60 tracking-widest">
					{"\u2593"} ROSTER {"\u2593"}
				</div>
				<ul className="space-y-1.5">
					{crewBots.map((bot, botIndex) => (
						<RosterRow
							bot={bot}
							index={botIndex}
							isActive={botIndex === index}
							key={bot.key}
							setIndex={setIndex}
						/>
					))}
				</ul>
			</div>
			<div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
				{crewBots.map((bot, botIndex) => (
					<ThumbBot
						bot={bot}
						index={botIndex}
						isActive={botIndex === index}
						key={bot.key}
						setIndex={setIndex}
					/>
				))}
			</div>
		</div>
	);
}

function RosterRow({
	bot,
	index,
	isActive,
	setIndex,
}: {
	bot: CrewBot;
	index: number;
	isActive: boolean;
	setIndex: (index: number) => void;
}): ReactElement {
	const accent = index % 2 ? "var(--neon-cyan)" : "var(--neon-pink)";
	const Icon = bot.icon;

	return (
		<li>
			<button
				className={`group flex w-full items-center gap-3 border-2 px-3 py-2.5 text-left transition-all ${
					isActive
						? "border-foreground bg-foreground text-background shadow-[3px_3px_0_0_var(--neon-pink)]"
						: "border-foreground/30 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:border-foreground hover:shadow-[3px_3px_0_0_var(--foreground)]"
				}`}
				onClick={() => setIndex(index)}
				onFocus={() => setIndex(index)}
				onMouseEnter={() => setIndex(index)}
				type="button"
			>
				<span
					className="w-6 shrink-0 font-pixel text-sm"
					style={{ color: isActive ? accent : undefined }}
				>
					0{index + 1}
				</span>
				<Icon
					className="h-4 w-4 shrink-0"
					strokeWidth={2}
					style={{ color: accent }}
				/>
				<div className="min-w-0 flex-1">
					<div className="font-pixel text-base uppercase leading-none">
						{bot.role}
					</div>
					<div
						className={`mt-0.5 truncate font-mono text-[10px] ${isActive ? "text-background/60" : "text-foreground/50"}`}
					>
						{bot.name} / {bot.tagline}
					</div>
				</div>
				<span
					className="shrink-0 border px-1.5 py-0.5 font-mono text-[9px] tracking-widest"
					style={{ borderColor: accent, color: accent }}
				>
					{bot.badge}
				</span>
			</button>
		</li>
	);
}

function ThumbBot({
	bot,
	index,
	isActive,
	setIndex,
}: {
	bot: CrewBot;
	index: number;
	isActive: boolean;
	setIndex: (index: number) => void;
}): ReactElement {
	const accent = index % 2 ? "var(--neon-cyan)" : "var(--neon-pink)";

	return (
		<button
			aria-label={bot.role}
			className={`relative h-14 w-14 shrink-0 overflow-hidden border-2 transition-all ${
				isActive
					? "border-foreground shadow-[3px_3px_0_0_var(--neon-pink)]"
					: "border-foreground/40 opacity-60 hover:opacity-100"
			}`}
			onClick={() => setIndex(index)}
			onMouseEnter={() => setIndex(index)}
			style={{ background: isActive ? `${accent}33` : "var(--background)" }}
			type="button"
		>
			<div className="absolute inset-0 flex items-end justify-center pb-0.5">
				<PixelBot face={bot.face} small variant={index} visor={bot.visor} />
			</div>
			{isActive ? (
				<span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 animate-pulse bg-[var(--neon-cyan)]" />
			) : null}
		</button>
	);
}
