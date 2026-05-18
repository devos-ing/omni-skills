import {
	Cpu,
	GitBranch,
	KanbanSquare,
	Send,
	Shield,
	Workflow,
} from "lucide-react";
import type { ReactElement } from "react";

const features = [
	{
		icon: Workflow,
		title: "The agentic loop",
		body: "Explore -> plan -> implement -> test -> loop. A disciplined cycle every agent runs, end to end.",
	},
	{
		icon: KanbanSquare,
		title: "Project board",
		body: "A shared board where humans and agents pick up tasks. Status, owner, and trail on every card.",
	},
	{
		icon: Send,
		title: "Telegram inbox",
		body: "Status, approvals, and pause/resume in chat. Every notification is actionable from your phone.",
	},
	{
		icon: Cpu,
		title: "Agent runtime",
		body: "Isolated, stateful runs with sub-second cold starts. Scale from one to thousands in parallel.",
	},
	{
		icon: GitBranch,
		title: "Branching & replay",
		body: "Every run is a checkpointed graph. Branch, replay, and diff trajectories like git for behavior.",
	},
	{
		icon: Shield,
		title: "Policy & guardrails",
		body: "Per-agent permissions, spending caps, and human-in-the-loop approvals. SOC 2 + HIPAA ready.",
	},
];

const colors = [
	"var(--neon-pink)",
	"var(--neon-cyan)",
	"var(--neon-yellow)",
	"var(--neon-lime)",
	"var(--neon-purple)",
	"var(--neon-pink)",
];

export function Features(): ReactElement {
	return (
		<section className="py-16 sm:py-24 md:py-32" id="platform">
			<div className="mx-auto max-w-7xl px-4 sm:px-6">
				<div className="max-w-2xl">
					<p className="mb-3 text-muted-foreground text-xs uppercase">
						The platform
					</p>
					<h2 className="font-pixel text-[clamp(2.5rem,5vw,4rem)] uppercase leading-none">
						Everything your agents need.{" "}
						<span className="text-[var(--neon-pink)]">
							Nothing they don&apos;t.
						</span>
					</h2>
				</div>
				<div className="mt-14 grid grid-cols-1 border-2 border-foreground bg-card md:grid-cols-2 lg:grid-cols-3">
					{features.map((feature, index) => {
						const Icon = feature.icon;
						return (
							<div
								className="-m-px border border-foreground p-8 transition hover:bg-muted"
								key={feature.title}
							>
								<div
									className="mb-5 flex h-12 w-12 items-center justify-center border-2 border-foreground"
									style={{ background: colors[index] }}
								>
									<Icon className="h-6 w-6 text-foreground" />
								</div>
								<h3 className="font-pixel text-2xl uppercase">
									{feature.title}
								</h3>
								<p className="mt-2 text-foreground/70 text-sm leading-relaxed">
									{feature.body}
								</p>
							</div>
						);
					})}
				</div>
			</div>
		</section>
	);
}
