"use client";

import { Cpu } from "lucide-react";
import { type ReactElement, useState } from "react";

import type {
	AgentTag,
	Skill,
	SkillBranch,
} from "@/components/redesign/redesign.types";
import {
	agentColor,
	allSkills,
	skillBranches,
} from "@/components/redesign/skills-tree-data";
import { SkillDetail } from "@/components/redesign/skills-tree-detail";

export function SkillsTree(): ReactElement {
	const [activeKey, setActiveKey] = useState(allSkills[0]?.key ?? "");
	const active =
		allSkills.find((skill) => skill.key === activeKey) ?? allSkills[0];

	return (
		<section
			className="relative overflow-hidden border-foreground border-y-2 bg-foreground py-16 text-background sm:py-24 md:py-32"
			id="skills"
		>
			<div className="pointer-events-none absolute inset-0 scanlines opacity-30" />
			<div className="relative mx-auto max-w-7xl px-4 sm:px-6">
				<div className="mb-10 max-w-2xl sm:mb-14">
					<p className="mb-3 font-mono text-background/60 text-xs uppercase tracking-[0.2em]">
						{"\u2593"} SKILL TREE {"\u2593"}
					</p>
					<h2 className="font-pixel text-[clamp(2.25rem,5vw,4rem)] uppercase leading-none">
						Skills the crew{" "}
						<span className="text-[var(--neon-cyan)]">can equip.</span>
					</h2>
					<p className="mt-5 max-w-md text-background/70 leading-relaxed">
						Every skill is a typed tool with a sandbox and an audit log. Agents
						pick the ones they need per run - no agent gets root-level access by
						default.
					</p>
				</div>
				<div className="grid gap-6 sm:gap-8 lg:grid-cols-[1fr_minmax(280px,360px)]">
					<div className="relative">
						<div className="flex justify-center">
							<RootNode />
						</div>
						<div className="flex justify-center">
							<div
								className="h-6 w-0.5"
								style={{
									backgroundImage:
										"linear-gradient(to bottom, var(--background) 50%, transparent 50%)",
									backgroundSize: "100% 6px",
								}}
							/>
						</div>
						<div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
							{skillBranches.map((branch) => (
								<BranchColumn
									activeKey={activeKey}
									branch={branch}
									key={branch.key}
									onPick={setActiveKey}
								/>
							))}
						</div>
						<SkillLegend />
					</div>
					<SkillDetail skill={active} />
				</div>
			</div>
		</section>
	);
}

function RootNode(): ReactElement {
	return (
		<div className="inline-flex items-center gap-2 border-2 border-background bg-background px-4 py-2 text-foreground shadow-[3px_3px_0_0_var(--neon-cyan)]">
			<Cpu className="h-4 w-4 text-[var(--neon-pink)]" strokeWidth={2} />
			<span className="font-pixel text-lg uppercase">devos.core</span>
		</div>
	);
}

function BranchColumn({
	activeKey,
	branch,
	onPick,
}: {
	activeKey: string;
	branch: SkillBranch;
	onPick: (key: string) => void;
}): ReactElement {
	const accent =
		branch.accent === "pink" ? "var(--neon-pink)" : "var(--neon-cyan)";
	const Icon = branch.icon;

	return (
		<div className="flex flex-col items-stretch">
			<div
				className="flex items-center gap-2 border-2 border-background px-2.5 py-2"
				style={{ background: accent, color: "var(--foreground)" }}
			>
				<Icon className="h-3.5 w-3.5" strokeWidth={2} />
				<div className="min-w-0">
					<div className="font-pixel text-base uppercase leading-none">
						{branch.label}
					</div>
					<div className="truncate font-mono text-[9px] opacity-80">
						{branch.blurb}
					</div>
				</div>
			</div>
			<div className="flex justify-center">
				<div
					className="h-4 w-0.5"
					style={{
						backgroundImage: `linear-gradient(to bottom, ${accent} 50%, transparent 50%)`,
						backgroundSize: "100% 4px",
					}}
				/>
			</div>
			<ul className="flex-1 space-y-2">
				{branch.skills.map((skill) => (
					<SkillButton
						accent={accent}
						isActive={skill.key === activeKey}
						key={skill.key}
						onPick={onPick}
						skill={skill}
					/>
				))}
			</ul>
		</div>
	);
}

function SkillButton({
	accent,
	isActive,
	onPick,
	skill,
}: {
	accent: string;
	isActive: boolean;
	onPick: (key: string) => void;
	skill: Skill;
}): ReactElement {
	const Icon = skill.icon;

	return (
		<li>
			<button
				className={`relative w-full border-2 border-background bg-background p-2 text-left text-foreground transition-all ${
					isActive
						? "-translate-x-0.5 -translate-y-0.5 shadow-[3px_3px_0_0_var(--neon-pink)]"
						: "opacity-80 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:opacity-100 hover:shadow-[3px_3px_0_0_var(--background)]"
				}`}
				onClick={() => onPick(skill.key)}
				onFocus={() => onPick(skill.key)}
				onMouseEnter={() => onPick(skill.key)}
				type="button"
			>
				<div className="mb-1.5 flex items-center gap-1.5">
					<Icon
						className="h-3 w-3 shrink-0"
						strokeWidth={2}
						style={{ color: accent }}
					/>
					<span className="truncate font-mono text-[11px]">{skill.name}</span>
				</div>
				<div className="flex flex-wrap gap-0.5">
					{skill.agents.map((agent) => (
						<span
							className="border border-foreground/40 px-1 py-0.5 font-mono text-[8px] leading-none tracking-widest"
							key={agent}
							style={{ color: agentColor[agent] }}
							title={agent}
						>
							{agent}
						</span>
					))}
				</div>
				{isActive ? (
					<span className="-left-1 absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 bg-[var(--neon-pink)]" />
				) : null}
			</button>
		</li>
	);
}

function SkillLegend(): ReactElement {
	return (
		<div className="mt-6 flex items-center gap-3 font-mono text-[10px] text-background/60">
			<span>LEGEND:</span>
			{(["SCOUT", "ARCH", "FORGE", "PROBE", "GATE"] as AgentTag[]).map(
				(agent) => (
					<span className="inline-flex items-center gap-1.5" key={agent}>
						<span
							className="inline-block h-2 w-2"
							style={{ background: agentColor[agent] }}
						/>
						{agent}
					</span>
				),
			)}
		</div>
	);
}
