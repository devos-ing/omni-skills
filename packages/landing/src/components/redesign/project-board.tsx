import {
	CheckCircle2,
	Circle,
	Clock,
	Filter,
	GitPullRequest,
	Plus,
} from "lucide-react";
import type { ReactElement } from "react";

import type {
	BoardColumn,
	BoardTask,
} from "@/components/redesign/redesign.types";

const columns: BoardColumn[] = [
	{ key: "backlog", title: "Backlog", tint: "text-muted-foreground" },
	{ key: "exploring", title: "Exploring", tint: "text-sky-600" },
	{ key: "planning", title: "Planning", tint: "text-violet-600" },
	{ key: "implementing", title: "Implementing", tint: "text-amber-600" },
	{ key: "testing", title: "Testing", tint: "text-rose-600" },
	{ key: "done", title: "Done", tint: "text-emerald-600" },
];

const cards: BoardTask[] = [
	{
		id: "DEV-204",
		title: "Refactor billing audit flow",
		status: "implementing",
		agent: "coder",
		meta: "PR #1294",
	},
	{
		id: "DEV-203",
		title: "Onboarding redesign - research",
		status: "exploring",
		agent: "researcher",
		meta: "12 sources",
	},
	{
		id: "DEV-202",
		title: "Sub-quota enforcement plan",
		status: "planning",
		agent: "planner",
		meta: "6 steps",
	},
	{
		id: "DEV-201",
		title: "Webhook retry test suite",
		status: "testing",
		agent: "reviewer",
		meta: "142 tests",
	},
	{
		id: "DEV-200",
		title: "Cron migration -> temporal",
		status: "done",
		agent: "deployer",
		meta: "shipped",
	},
	{
		id: "DEV-199",
		title: "Audit log retention policy",
		status: "backlog",
		agent: "-",
	},
	{ id: "DEV-198", title: "SSO group sync", status: "backlog", agent: "-" },
];

export function ProjectBoard(): ReactElement {
	return (
		<section
			className="border-border/50 border-t py-16 sm:py-24 md:py-32"
			id="board"
		>
			<div className="mx-auto max-w-7xl px-4 sm:px-6">
				<div className="grid min-w-0 items-start gap-8 lg:grid-cols-12 lg:gap-12">
					<div className="min-w-0 lg:col-span-4">
						<p className="mb-3 text-muted-foreground text-xs uppercase">
							Project board
						</p>
						<h2 className="font-pixel text-[clamp(2.5rem,5vw,4rem)] text-[var(--neon-purple)] uppercase leading-none">
							Manage agents
							<br />
							like a team.
						</h2>
						<p className="mt-5 max-w-md text-muted-foreground leading-relaxed">
							Every task is a card. Every card has a status, an owner, and a
							trail. Drag work between humans and agents - the board is the
							source of truth.
						</p>
						<ul className="mt-7 space-y-3 text-sm">
							{[
								"Group by goal, owner, or agent",
								"One-click handoff between agent and human",
								"Full run history with replayable trajectories",
								"Real-time sync to Linear, Jira, GitHub",
							].map((item) => (
								<li className="flex items-start gap-2" key={item}>
									<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-foreground/60" />
									<span className="text-muted-foreground">{item}</span>
								</li>
							))}
						</ul>
					</div>
					<div className="min-w-0 lg:col-span-8">
						<div className="max-w-full overflow-hidden border-2 border-foreground bg-card shadow-retro">
							<div className="flex h-11 items-center justify-between border-foreground border-b-2 bg-foreground px-4 text-background">
								<div className="flex items-center gap-2 font-mono text-xs">
									<div className="h-4 w-4 rounded-sm bg-foreground" />
									<span>devos.ing/board</span>
									<span className="text-muted-foreground">/ q2-platform</span>
								</div>
								<div className="flex items-center gap-2">
									<button
										className="inline-flex items-center gap-1 border border-background/70 px-2 py-1 text-xs"
										type="button"
									>
										<Filter className="h-3 w-3" /> Filter
									</button>
									<button
										className="inline-flex items-center gap-1 border border-background/70 bg-[var(--neon-pink)] px-2 py-1 text-foreground text-xs"
										type="button"
									>
										<Plus className="h-3 w-3" /> New
									</button>
								</div>
							</div>
							<div className="flex min-h-[360px] w-full divide-x-2 divide-foreground overflow-x-auto">
								{columns.map((column) => (
									<BoardColumnView column={column} key={column.key} />
								))}
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

function BoardColumnView({ column }: { column: BoardColumn }): ReactElement {
	const items = cards.filter((card) => card.status === column.key);

	return (
		<div className="flex min-w-[150px] flex-1 flex-col">
			<div className="flex items-center justify-between border-foreground border-b-2 bg-muted px-3 py-2.5">
				<div className="flex items-center gap-1.5">
					<span className={`h-2 w-2 bg-current ${column.tint}`} />
					<span className="font-pixel text-[11px] uppercase tracking-wider">
						{column.title}
					</span>
				</div>
				<span className="font-mono text-[10px]">{items.length}</span>
			</div>
			<div className="flex-1 space-y-2 p-2">
				{items.map((card) => (
					<BoardCard card={card} key={card.id} />
				))}
			</div>
		</div>
	);
}

function BoardCard({ card }: { card: BoardTask }): ReactElement {
	const isDone = card.status === "done";
	const StatusIcon = isDone
		? CheckCircle2
		: card.status === "backlog"
			? Circle
			: Clock;

	return (
		<div className="cursor-grab border-2 border-foreground bg-card p-2.5 shadow-[2px_2px_0_0_var(--foreground)] transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-[3px_3px_0_0_var(--foreground)]">
			<div className="mb-1.5 flex items-center justify-between">
				<span className="font-mono text-[10px] text-muted-foreground">
					{card.id}
				</span>
				<StatusIcon
					className={`h-3 w-3 ${
						isDone
							? "text-emerald-600"
							: card.status === "backlog"
								? "text-muted-foreground/60"
								: "text-muted-foreground"
					}`}
				/>
			</div>
			<div className="text-[12px] leading-snug">{card.title}</div>
			{card.meta ? (
				<div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
					<GitPullRequest className="h-2.5 w-2.5" />
					<span className="font-mono">{card.agent}</span>
					<span>{"\u00B7"}</span>
					<span>{card.meta}</span>
				</div>
			) : null}
		</div>
	);
}
