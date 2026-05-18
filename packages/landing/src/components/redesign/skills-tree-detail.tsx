import type { ReactElement } from "react";

import type { Skill } from "@/components/redesign/redesign.types";
import { agentColor } from "@/components/redesign/skills-tree-data";

export function SkillDetail({ skill }: { skill: Skill }): ReactElement {
	const Icon = skill.icon;

	return (
		<aside
			className="self-start border-2 border-background bg-background p-4 text-foreground shadow-[6px_6px_0_0_var(--neon-pink)] sm:p-5"
			key={skill.key}
		>
			<div className="mb-2 flex items-center gap-2 font-mono text-[10px] text-foreground/60 tracking-widest">
				<Icon className="h-3.5 w-3.5 text-[var(--neon-pink)]" strokeWidth={2} />
				SKILL / {skill.key.toUpperCase()}
			</div>
			<div className="mb-3 font-pixel text-2xl uppercase leading-none">
				{skill.name}
			</div>
			<p className="text-foreground/80 text-sm leading-relaxed">
				{skill.description}
			</p>
			<div className="mt-4">
				<div className="mb-1.5 font-mono text-[10px] text-foreground/60 tracking-widest">
					EXAMPLE
				</div>
				<pre className="overflow-x-auto bg-foreground px-3 py-2 font-mono text-[11px] text-background">
					<code>{skill.example}</code>
				</pre>
			</div>
			<div className="mt-4">
				<div className="mb-2 font-mono text-[10px] text-foreground/60 tracking-widest">
					EQUIPPED BY
				</div>
				<div className="flex flex-wrap gap-1.5">
					{skill.agents.map((agent) => (
						<span
							className="inline-flex items-center gap-1.5 border-2 border-foreground px-2 py-0.5 font-mono text-[10px] tracking-widest"
							key={agent}
							style={{ background: agentColor[agent] }}
						>
							<span className="h-1.5 w-1.5 bg-foreground" />
							{agent}
						</span>
					))}
				</div>
			</div>
			<div className="mt-5 border-foreground/30 border-t-2 border-dashed pt-4 font-mono text-[10px] text-foreground/60 leading-relaxed">
				{"\u25B2"} Sandboxed. Audit-logged. Revocable per-run.
			</div>
		</aside>
	);
}
