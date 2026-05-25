"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { IssueWorkflowRunState } from "./use-issue-workflow-run";

export function IssueWorkflowRunPanel({
	runState,
	onClose,
}: {
	runState: IssueWorkflowRunState;
	onClose: () => void;
}): ReactElement | null {
	if (runState.status === "idle") {
		return null;
	}
	const isRunning = runState.status === "running";
	const hasFailed =
		runState.status === "failed" || runState.status === "rejected";
	const StatusIcon = isRunning ? Loader2 : hasFailed ? XCircle : CheckCircle2;

	return (
		<section className="fixed right-5 bottom-5 z-30 grid w-[min(32rem,calc(100vw-2rem))] gap-3 rounded-lg border border-zinc-800 bg-[#15161a] p-4 text-zinc-100 shadow-2xl">
			<header className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<div className="flex items-center gap-2">
						<StatusIcon
							className={cn(
								isRunning && "animate-spin",
								hasFailed && "text-red-300",
							)}
							size={17}
						/>
						<h2 className="m-0 text-sm font-semibold">Workflow Run</h2>
					</div>
					<p className="mt-1 mb-0 truncate text-xs text-zinc-500">
						{runState.task
							? `${runState.task.taskKey} · ${runState.task.title}`
							: "No issue selected"}
					</p>
				</div>
				{isRunning ? null : (
					<Button
						aria-label="Close workflow run panel"
						onClick={onClose}
						size="icon"
						type="button"
						variant="ghost"
					>
						<XCircle size={16} />
					</Button>
				)}
			</header>
			<div className="grid max-h-56 gap-1 overflow-auto rounded-md border border-zinc-800 bg-[#101115] p-3 font-mono text-xs text-zinc-300">
				{runState.logs.map((line) => (
					<p
						className={cn(
							"m-0 whitespace-pre-wrap break-words",
							line.stream === "stderr" && "text-amber-200",
							line.stream === "system" && "text-zinc-500",
							line.stream === "progress" && "text-sky-200",
						)}
						key={line.id}
					>
						{line.text}
					</p>
				))}
			</div>
		</section>
	);
}
