"use client";

import { Brain, Code2, Rocket, Search, ShieldCheck } from "lucide-react";
import { type ReactElement, useState } from "react";

import type {
	AgentKey,
	AgentProfile,
} from "@/components/redesign/redesign.types";

const agents: Record<AgentKey, AgentProfile> = {
	planner: {
		name: "planner",
		role: "Decomposes goals into a typed plan",
		icon: Brain,
		color: "text-sky-600",
		dot: "bg-sky-500",
		tools: ["graph.build", "memory.read", "agents.dispatch"],
		command: 'devos run "ship onboarding redesign"',
		lines: [
			{ tag: "you", text: 'devos run "ship onboarding redesign"' },
			{
				tag: "planner",
				text: "Loaded workspace context (12 repos, 4 design docs).",
			},
			{
				tag: "planner",
				text: "Decomposed into 6 steps: audit / spec / design / build / review / ship.",
			},
			{ tag: "planner", text: "Dispatching to researcher, coder. ETA 14m." },
		],
		metrics: [
			{ label: "Steps", value: "6" },
			{ label: "Subagents", value: "2" },
			{ label: "Tokens", value: "8.2k" },
		],
	},
	researcher: {
		name: "researcher",
		role: "Gathers grounded context from your stack",
		icon: Search,
		color: "text-violet-600",
		dot: "bg-violet-500",
		tools: ["notion.query", "linear.search", "web.fetch", "memory.write"],
		command: 'devos agent researcher --task "onboarding patterns"',
		lines: [
			{
				tag: "you",
				text: 'devos agent researcher --task "onboarding patterns"',
			},
			{ tag: "researcher", text: "Searched Notion / 14 hits." },
			{
				tag: "researcher",
				text: "Pulled 12 reference patterns from Linear + Notion.",
			},
			{
				tag: "researcher",
				text: "Synthesized memo -> memory://onboarding/refs#v3",
			},
		],
		metrics: [
			{ label: "Sources", value: "26" },
			{ label: "Cited", value: "12" },
			{ label: "Tokens", value: "21k" },
		],
	},
	coder: {
		name: "coder",
		role: "Writes, refactors, and tests code in your repo",
		icon: Code2,
		color: "text-amber-600",
		dot: "bg-amber-500",
		tools: ["repo.edit", "shell.exec", "tests.run", "pr.open"],
		command: "devos agent coder --branch feat/onboarding",
		lines: [
			{ tag: "you", text: "devos agent coder --branch feat/onboarding" },
			{ tag: "coder", text: "Edited 8 files in apps/web." },
			{ tag: "coder", text: "Ran 142 tests / all green" },
			{ tag: "coder", text: "Opened PR #1294 -> ready for review." },
		],
		metrics: [
			{ label: "Files", value: "8" },
			{ label: "Tests", value: "142" },
			{ label: "PR", value: "#1294" },
		],
	},
	reviewer: {
		name: "reviewer",
		role: "Audits diffs, design, and behavior",
		icon: ShieldCheck,
		color: "text-rose-600",
		dot: "bg-rose-500",
		tools: ["pr.diff", "design.compare", "policy.check"],
		command: "devos agent reviewer --pr 1294",
		lines: [
			{ tag: "you", text: "devos agent reviewer --pr 1294" },
			{ tag: "reviewer", text: "Diff: +412 / -187 across 8 files." },
			{ tag: "reviewer", text: "2 suggestions, 0 blockers." },
			{ tag: "reviewer", text: "Awaiting human approval to merge." },
		],
		metrics: [
			{ label: "Suggestions", value: "2" },
			{ label: "Blockers", value: "0" },
			{ label: "Risk", value: "low" },
		],
	},
	deployer: {
		name: "deployer",
		role: "Ships to staging and production with guardrails",
		icon: Rocket,
		color: "text-emerald-600",
		dot: "bg-emerald-500",
		tools: ["ci.trigger", "flags.update", "rollout.canary"],
		command: "devos agent deployer --env prod",
		lines: [
			{ tag: "you", text: "devos agent deployer --env prod" },
			{ tag: "deployer", text: "Canary rollout to 5% / health OK." },
			{
				tag: "deployer",
				text: "Promoted to 100%. p95 latency -4ms.",
			},
			{ tag: "deployer", text: "Posted release notes to #ship." },
		],
		metrics: [
			{ label: "Canary", value: "5->100%" },
			{ label: "Delta p95", value: "-4ms" },
			{ label: "Errors", value: "0" },
		],
	},
};

export function ProductPreview(): ReactElement {
	const [active, setActive] = useState<AgentKey>("planner");
	const agent = agents[active];
	const Icon = agent.icon;

	return (
		<div className="relative mx-auto max-w-5xl">
			<div className="overflow-hidden border-2 border-foreground bg-card shadow-retro">
				<div className="flex h-10 items-center justify-between border-foreground border-b-2 bg-foreground px-4 text-background">
					<div className="flex items-center gap-1.5">
						<span className="h-3 w-3 border border-background bg-[var(--neon-pink)]" />
						<span className="h-3 w-3 border border-background bg-[var(--neon-yellow)]" />
						<span className="h-3 w-3 border border-background bg-[var(--neon-lime)]" />
					</div>
					<div className="truncate px-2 font-mono text-xs">
						DEVOS.ING / RUN #4821 / {agent.name.toUpperCase()}
					</div>
					<div className="w-12" />
				</div>
				<div className="grid grid-cols-12">
					<aside className="col-span-5 border-foreground border-r-2 bg-muted p-2 sm:col-span-4 sm:p-3 md:col-span-3">
						<div className="mb-2 px-2 text-[10px] text-muted-foreground uppercase">
							Agents
						</div>
						<ul className="space-y-0.5">
							{Object.values(agents).map((profile) => (
								<li key={profile.name}>
									<button
										className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition ${
											active === profile.name
												? "bg-foreground text-background"
												: "hover:bg-foreground/5"
										}`}
										onClick={() => setActive(profile.name)}
										type="button"
									>
										<profile.icon className="h-3.5 w-3.5 shrink-0" />
										<span className="truncate font-mono text-xs">
											{profile.name}
										</span>
										{active === profile.name ? (
											<span className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
										) : null}
									</button>
								</li>
							))}
						</ul>
						<div className="mt-5 px-2">
							<div className="mb-2 text-[10px] text-muted-foreground uppercase">
								Tools
							</div>
							<div className="flex flex-wrap gap-1">
								{agent.tools.map((tool) => (
									<span
										className="border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
										key={tool}
									>
										{tool}
									</span>
								))}
							</div>
						</div>
					</aside>
					<div className="col-span-7 flex min-h-[320px] min-w-0 flex-col bg-background sm:col-span-8 md:col-span-9">
						<div className="flex items-center justify-between gap-4 border-border/60 border-b px-3 py-3 sm:px-5">
							<div className="flex min-w-0 items-center gap-2">
								<Icon className={`h-4 w-4 shrink-0 ${agent.color}`} />
								<div className="min-w-0">
									<div className="font-mono text-xs">{agent.name}</div>
									<div className="hidden truncate text-[11px] text-muted-foreground sm:block">
										{agent.role}
									</div>
								</div>
							</div>
							<div className="hidden items-center gap-4 md:flex">
								{agent.metrics.map((metric) => (
									<div className="text-right" key={metric.label}>
										<div className="font-mono text-xs">{metric.value}</div>
										<div className="text-[9px] text-muted-foreground uppercase">
											{metric.label}
										</div>
									</div>
								))}
							</div>
						</div>
						<div className="flex-1 overflow-x-auto p-3 font-mono text-[11px] leading-6 sm:p-5 sm:text-xs">
							<div className="break-all text-muted-foreground">
								-&gt; {agent.command}
							</div>
							<div className="mt-3 space-y-2">
								{agent.lines.slice(1).map((line) => (
									<div
										className="flex gap-2 sm:gap-3"
										key={`${agent.name}-${String(line.text)}`}
									>
										<span className={`${agent.color} shrink-0`}>
											[{line.tag}]
										</span>
										<span className="text-foreground/80">{line.text}</span>
									</div>
								))}
								<div className="flex items-center gap-2 pt-3 text-muted-foreground">
									<span className="h-3 w-1.5 animate-pulse bg-foreground" />
									<span>monitoring{"\u2026"}</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
