import { Cpu, Database, GitMerge, Lightbulb, Send } from "lucide-react";
import type { ReactElement } from "react";

import {
	Connector,
	FlowNode,
	PipelineRow,
} from "@/components/redesign/flow-nodes";

export function FlowDiagram(): ReactElement {
	return (
		<div className="relative overflow-hidden border-2 border-foreground bg-card p-4 shadow-retro sm:p-8 md:p-12">
			<div
				className="pointer-events-none absolute inset-0 opacity-[0.08]"
				style={{
					backgroundImage:
						"linear-gradient(to right, var(--foreground) 1px, transparent 1px), linear-gradient(to bottom, var(--foreground) 1px, transparent 1px)",
					backgroundSize: "24px 24px",
				}}
			/>
			<MobileFlow />
			<DesktopFlow />
		</div>
	);
}

function MobileFlow(): ReactElement {
	return (
		<div className="relative flex flex-col items-stretch gap-3 lg:hidden">
			<div className="grid grid-cols-2 gap-3">
				<FlowNode
					color="pink"
					icon={Lightbulb}
					label="Idea / Task"
					sub="dev / pm"
				/>
				<FlowNode icon={Database} label="Server DB" sub="task queue" />
			</div>
			<Connector />
			<FlowNode
				big
				color="cyan"
				icon={Cpu}
				label="devos daemon"
				sub="orchestrates everything"
			/>
			<Connector />
			<PipelineRow />
			<Connector />
			<div className="grid grid-cols-2 gap-3">
				<FlowNode
					color="cyan"
					icon={Send}
					label="Telegram bot"
					sub="/status /inbox"
				/>
				<FlowNode
					color="pink"
					icon={GitMerge}
					label="GitHub bot"
					sub="review / merge"
				/>
			</div>
		</div>
	);
}

function DesktopFlow(): ReactElement {
	return (
		<div className="relative hidden min-h-[520px] lg:block">
			<svg
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
				preserveAspectRatio="none"
				viewBox="0 0 100 100"
			>
				<defs>
					<marker
						id="arr"
						markerHeight="5"
						markerUnits="strokeWidth"
						markerWidth="5"
						orient="auto-start-reverse"
						refX="9"
						refY="5"
						viewBox="0 0 10 10"
					>
						<path d="M0,0 L10,5 L0,10 z" fill="var(--foreground)" />
					</marker>
				</defs>
				<Line d="M 24 50 L 38 50" />
				<Line d="M 50 20 L 50 42" />
				<Line d="M 50 58 L 50 80" />
				<Line d="M 60 45 L 76 27" />
				<Line d="M 60 55 L 76 73" />
			</svg>
			<Position left="15%" top="50%">
				<FlowNode
					color="pink"
					icon={Lightbulb}
					label="Idea / Task"
					sub="dev / pm"
				/>
			</Position>
			<Position left="50%" top="14%">
				<FlowNode icon={Database} label="Server DB" sub="task queue" />
			</Position>
			<Position left="50%" top="50%">
				<FlowNode
					big
					color="cyan"
					icon={Cpu}
					label="devos daemon"
					sub="orchestrator core"
				/>
			</Position>
			<Position left="50%" top="86%">
				<PipelineRow />
			</Position>
			<Position left="85%" top="22%">
				<FlowNode
					color="cyan"
					icon={Send}
					label="Telegram bot"
					sub="/status /inbox"
				/>
			</Position>
			<Position left="85%" top="78%">
				<FlowNode
					color="pink"
					icon={GitMerge}
					label="GitHub bot"
					sub="review / merge"
				/>
			</Position>
		</div>
	);
}

function Position({
	children,
	left,
	top,
}: {
	children: ReactElement;
	left: string;
	top: string;
}): ReactElement {
	return (
		<div
			className="absolute -translate-x-1/2 -translate-y-1/2"
			style={{ left, top }}
		>
			{children}
		</div>
	);
}

function Line({ d }: { d: string }): ReactElement {
	return (
		<path
			d={d}
			fill="none"
			markerEnd="url(#arr)"
			stroke="var(--foreground)"
			strokeDasharray="6 4"
			strokeLinecap="square"
			strokeWidth={2}
			vectorEffect="non-scaling-stroke"
		>
			<animate
				attributeName="stroke-dashoffset"
				dur="1.2s"
				from="0"
				repeatCount="indefinite"
				to="-20"
			/>
		</path>
	);
}
