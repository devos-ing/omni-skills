"use client";

import { Bot, Cpu, Server } from "lucide-react";
import { type ReactElement, useMemo } from "react";

import { useAgentsQuery } from "@/lib/api/queries";

import type { RuntimeSummary } from "./runtimes-panel.types";
import { deriveRuntimeSummaries } from "./runtimes-panel-utils";

export function RuntimesPanel(): ReactElement {
	const agentsQuery = useAgentsQuery();
	const runtimes = useMemo(
		() => deriveRuntimeSummaries(agentsQuery.data ?? []),
		[agentsQuery.data],
	);

	if (agentsQuery.isPending) {
		return <RuntimeStatePanel message="Loading runtimes..." title="Runtimes" />;
	}

	if (agentsQuery.isError) {
		return (
			<RuntimeStatePanel
				message={agentsQuery.error.message || "Failed to load runtimes."}
				title="Runtimes"
				tone="error"
			/>
		);
	}

	if (runtimes.length === 0) {
		return <RuntimeStatePanel message="No runtimes are configured." title="Runtimes" />;
	}

	return (
		<section className="grid gap-4" aria-labelledby="runtimes-title">
			<header className="flex flex-wrap items-end justify-between gap-3">
				<div className="grid gap-1">
					<h2
						className="m-0 text-base font-semibold text-zinc-100"
						id="runtimes-title"
					>
						Configured runtimes
					</h2>
					<p className="m-0 text-sm text-zinc-500">
						{runtimes.length} runtime{runtimes.length === 1 ? "" : "s"} across{" "}
						{agentsQuery.data?.length ?? 0} agent
						{agentsQuery.data?.length === 1 ? "" : "s"}
					</p>
				</div>
				<div className="inline-flex items-center gap-2 rounded-md border border-zinc-800 px-3 py-2 text-sm text-zinc-300">
					<Server size={15} />
					Capacity {totalCapacity(runtimes)}
				</div>
			</header>
			<ul className="m-0 grid list-none gap-3 p-0">
				{runtimes.map((runtime) => (
					<RuntimeCard key={runtime.id} runtime={runtime} />
				))}
			</ul>
		</section>
	);
}

function RuntimeCard({
	runtime,
}: {
	runtime: RuntimeSummary;
}): ReactElement {
	return (
		<li className="grid gap-3 rounded-lg border border-zinc-800 bg-[#18191d] p-4">
			<header className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex min-w-0 items-start gap-3">
					<span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-zinc-700 bg-zinc-900 text-zinc-200">
						<Cpu size={17} />
					</span>
					<div className="min-w-0">
						<h3 className="m-0 break-words text-sm font-semibold text-zinc-100">
							{runtime.label}
						</h3>
						<p className="m-0 break-words text-xs text-zinc-500">
							{runtime.id}
						</p>
					</div>
				</div>
				<div className="flex flex-wrap gap-2 text-xs text-zinc-300">
					<RuntimeMetric label="Agents" value={runtime.agentCount} />
					<RuntimeMetric label="Capacity" value={runtime.totalConcurrency} />
				</div>
			</header>
			<div className="grid gap-3 md:grid-cols-3">
				<RuntimeChips label="Backends" values={runtime.backendLabels} />
				<RuntimeChips label="Models" values={runtime.models} />
				<RuntimeChips label="Owners" values={runtime.owners} />
			</div>
			<RuntimeAgents runtime={runtime} />
		</li>
	);
}

function RuntimeMetric({
	label,
	value,
}: {
	label: string;
	value: number;
}): ReactElement {
	return (
		<span className="inline-flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1">
			<span className="text-zinc-500">{label}</span>
			<strong className="font-semibold text-zinc-100">{value}</strong>
		</span>
	);
}

function RuntimeChips({
	label,
	values,
}: {
	label: string;
	values: string[];
}): ReactElement {
	return (
		<div className="grid content-start gap-2">
			<p className="m-0 text-xs font-medium uppercase text-zinc-500">{label}</p>
			<div className="flex flex-wrap gap-2">
				{values.map((value) => (
					<span
						className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-300"
						key={value}
					>
						{value}
					</span>
				))}
			</div>
		</div>
	);
}

function RuntimeAgents({
	runtime,
}: {
	runtime: RuntimeSummary;
}): ReactElement {
	return (
		<div className="grid gap-2">
			<p className="m-0 text-xs font-medium uppercase text-zinc-500">Agents</p>
			<ul className="m-0 grid list-none gap-2 p-0">
				{runtime.agents.map((agent) => (
					<li
						className="grid gap-1 rounded-md border border-zinc-800 bg-[#141519] p-3 sm:grid-cols-[1fr_auto]"
						key={agent.id}
					>
						<div className="min-w-0">
							<p className="m-0 flex min-w-0 items-center gap-2 text-sm text-zinc-100">
								<Bot className="shrink-0" size={15} />
								<span className="break-words">{agent.name}</span>
							</p>
							<p className="m-0 break-words text-xs text-zinc-500">{agent.id}</p>
						</div>
						<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400 sm:justify-end">
							<span>{agent.model}</span>
							<span>Owner {agent.owner}</span>
							<span>Concurrency {agent.concurrency}</span>
						</div>
					</li>
				))}
			</ul>
		</div>
	);
}

function RuntimeStatePanel({
	title,
	message,
	tone = "default",
}: {
	title: string;
	message: string;
	tone?: "default" | "error";
}): ReactElement {
	const className =
		tone === "error"
			? "grid gap-3 rounded-lg border border-red-900/50 bg-red-950/20 p-4"
			: "grid gap-3 rounded-lg border border-zinc-800 bg-[#18191d] p-4";

	return (
		<section className={className}>
			<h2 className="m-0 text-base font-semibold text-zinc-200">{title}</h2>
			<p className="m-0 text-sm text-zinc-500">{message}</p>
		</section>
	);
}

function totalCapacity(runtimes: RuntimeSummary[]): number {
	return runtimes.reduce((total, runtime) => total + runtime.totalConcurrency, 0);
}
