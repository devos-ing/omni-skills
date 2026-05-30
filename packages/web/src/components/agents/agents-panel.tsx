"use client";

import { Search } from "lucide-react";
import { type ReactElement, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Typography } from "@/components/ui/typography";
import type { AgentRecord, SettingsReasoningEffort } from "@/lib/api";
import { useAgentsQuery, useModelSettingsQuery } from "@/lib/api/queries";

import { AgentModelEditDialog } from "./agent-model-edit-dialog";
import { AgentStatePanel } from "./agent-state-panel";
import { AgentTableRow } from "./agent-table-row";
import {
	AGENT_STATUS_FILTERS,
	deriveAgentRows,
	filterAgentRows,
	summarizeAgentCounts,
} from "./agents-panel-utils";
import type {
	AgentModelEditOptions,
	AgentStatusFilter,
} from "./types/agent-list.types";

const FALLBACK_REASONING: SettingsReasoningEffort[] = [
	"low",
	"medium",
	"high",
	"xhigh",
];

export function AgentsPanel(): ReactElement {
	const agentsQuery = useAgentsQuery();
	const modelSettingsQuery = useModelSettingsQuery({
		refetchIntervalMs: false,
	});
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState<AgentStatusFilter>("all");
	const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
	const rows = useMemo(
		() => deriveAgentRows(agentsQuery.data ?? []),
		[agentsQuery.data],
	);
	const counts = useMemo(() => summarizeAgentCounts(rows), [rows]);
	const visibleRows = useMemo(
		() => filterAgentRows(rows, searchTerm, statusFilter),
		[rows, searchTerm, statusFilter],
	);
	const editingAgent =
		agentsQuery.data?.find((agent) => agent.id === editingAgentId) ?? null;
	const editOptions = useMemo<AgentModelEditOptions>(
		() => ({
			models: modelOptions(
				modelSettingsQuery.data?.availableModels,
				editingAgent,
			),
			reasoningEfforts:
				modelSettingsQuery.data?.reasoningEfforts ?? FALLBACK_REASONING,
		}),
		[
			editingAgent,
			modelSettingsQuery.data?.availableModels,
			modelSettingsQuery.data?.reasoningEfforts,
		],
	);

	if (agentsQuery.isPending) {
		return <AgentStatePanel message="Loading agents..." title="Agents" />;
	}

	if (agentsQuery.isError) {
		return (
			<AgentStatePanel
				message={agentsQuery.error.message || "Failed to load agents."}
				title="Agents"
				tone="error"
			/>
		);
	}

	return (
		<section className="grid h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] min-h-[28rem] overflow-hidden rounded-lg border border-border bg-card text-zinc-100">
			<header className="grid gap-4 border-b border-border p-4">
				<div className="flex flex-wrap items-center gap-3">
					<div className="relative min-w-[16rem] flex-1">
						<Search
							aria-hidden
							className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
							size={18}
						/>
						<Input
							aria-label="Search agents"
							className="h-11 pl-10 text-base"
							onChange={(event) => setSearchTerm(event.target.value)}
							placeholder="Search agents..."
							value={searchTerm}
						/>
					</div>
					<Typography className="text-sm text-zinc-400">
						{visibleRows.length} of {rows.length}
					</Typography>
				</div>
				<div className="flex flex-wrap gap-2">
					{AGENT_STATUS_FILTERS.map((filter) => (
						<Button
							aria-pressed={statusFilter === filter}
							className={
								statusFilter === filter
									? "border-zinc-500 bg-surface-active text-zinc-100"
									: "text-zinc-400"
							}
							key={filter}
							onClick={() => setStatusFilter(filter)}
							type="button"
							variant="outline"
						>
							{statusFilterLabel(filter)} {counts[filter]}
						</Button>
					))}
				</div>
			</header>
			<div className="min-h-0 overflow-auto">
				<table className="min-w-[58rem] table-fixed border-collapse text-left">
					<thead className="sticky top-0 z-10 bg-surface-panel">
						<tr className="border-b border-border text-xs uppercase tracking-[0.14em] text-zinc-400">
							<th className="w-[21%] px-4 py-3 font-medium">Agent</th>
							<th className="w-[9%] px-3 py-3 font-medium">Status</th>
							<th className="w-[13%] px-3 py-3 font-medium">Workload</th>
							<th className="w-[18%] px-3 py-3 font-medium">Runtime</th>
							<th className="w-[14%] px-3 py-3 font-medium">Activity</th>
							<th className="w-[6%] px-3 py-3 text-right font-medium">Runs</th>
							<th className="w-[14%] px-3 py-3 font-medium">Agent Model</th>
							<th className="w-[3rem] px-3 py-3 font-medium" />
						</tr>
					</thead>
					<tbody>
						{visibleRows.length > 0 ? (
							visibleRows.map((row) => (
								<AgentTableRow
									key={row.id}
									onEdit={() => setEditingAgentId(row.id)}
									row={row}
								/>
							))
						) : (
							<tr>
								<td
									className="px-4 py-10 text-center text-zinc-500"
									colSpan={8}
								>
									No agents match the current filters.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
			{editingAgent ? (
				<AgentModelEditDialog
					agent={editingAgent}
					onClose={() => setEditingAgentId(null)}
					options={editOptions}
				/>
			) : null}
		</section>
	);
}

function statusFilterLabel(filter: AgentStatusFilter): string {
	switch (filter) {
		case "all":
			return "All";
		case "online":
			return "Online";
		case "offline":
			return "Offline";
	}
}

function modelOptions(
	models: Array<{ id: string }> | undefined,
	agent: AgentRecord | null,
): string[] {
	const options = new Set(models?.map((model) => model.id) ?? []);
	if (agent?.model) {
		options.add(agent.model);
	}
	return [...options].sort((left, right) => left.localeCompare(right));
}
