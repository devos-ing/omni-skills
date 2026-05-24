"use client";

import { Folder } from "lucide-react";
import type { ReactElement } from "react";

import { cn } from "@/lib/utils";

import type {
	ProjectDisplayRow,
	ProjectTableDensity,
} from "./types/projects-panel.types";

const PROJECT_TABLE_COLUMN_COUNT = 6;

interface ProjectsTableProps {
	density: ProjectTableDensity;
	error: Error | null;
	isLoading: boolean;
	rows: ProjectDisplayRow[];
	searchQuery: string;
	totalCount: number;
}

export function ProjectsTable({
	density,
	error,
	isLoading,
	rows,
	searchQuery,
	totalCount,
}: ProjectsTableProps): ReactElement {
	const rowPadding = density === "compact" ? "px-4 py-2.5" : "px-4 py-4";
	const stateLabel = resolveProjectTableState({
		error,
		isLoading,
		rowCount: rows.length,
		searchQuery,
		totalCount,
	});

	return (
		<section className="min-h-0 overflow-hidden rounded-lg border border-zinc-800 bg-[#141519]">
			<div className="h-full overflow-x-auto">
				<table className="h-full w-full min-w-[58rem] table-fixed border-collapse">
					<colgroup>
						<col className="w-[34%]" />
						<col className="w-[10%]" />
						<col className="w-[14%]" />
						<col className="w-[18%]" />
						<col className="w-[12%]" />
						<col className="w-[12%]" />
					</colgroup>
					<thead className="bg-[#18191d] text-left text-xs font-medium text-zinc-500">
						<tr className="border-b border-zinc-800">
							<TableHeaderCell label="Name" />
							<TableHeaderCell label="Priority" />
							<TableHeaderCell label="Category" />
							<TableHeaderCell label="Repository" />
							<TableHeaderCell label="Lead" />
							<TableHeaderCell label="Created" />
						</tr>
					</thead>
					<tbody className="text-sm text-zinc-300">
						{stateLabel ? (
							<tr>
								<td
									className="h-72 px-4 text-center text-sm text-zinc-500"
									colSpan={PROJECT_TABLE_COLUMN_COUNT}
								>
									{stateLabel}
								</td>
							</tr>
						) : (
							rows.map((row) => (
								<ProjectTableRow
									key={row.project.id}
									row={row}
									rowPadding={rowPadding}
								/>
							))
						)}
					</tbody>
				</table>
			</div>
		</section>
	);
}

function TableHeaderCell({ label }: { label: string }): ReactElement {
	return (
		<th className="h-10 whitespace-nowrap px-4 align-middle font-medium">
			{label}
		</th>
	);
}

function ProjectTableRow({
	row,
	rowPadding,
}: {
	row: ProjectDisplayRow;
	rowPadding: string;
}): ReactElement {
	return (
		<tr className="border-b border-zinc-800/80 last:border-b-0 hover:bg-zinc-900/60">
			<td className={cn(rowPadding, "align-middle")}>
				<div className="flex min-w-0 items-center gap-3">
					<span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-zinc-700 bg-zinc-900 text-zinc-400">
						<Folder size={14} />
					</span>
					<div className="min-w-0">
						<p className="m-0 truncate font-medium text-zinc-100">
							{row.project.name}
						</p>
						<p className="m-0 truncate text-xs text-zinc-500">
							{row.summaryLabel}
						</p>
					</div>
				</div>
			</td>
			<TableCell
				className="font-medium text-zinc-200"
				rowPadding={rowPadding}
				value={row.priorityLabel}
			/>
			<TableCell rowPadding={rowPadding} value={row.categoryLabel} />
			<TableCell rowPadding={rowPadding} value={row.repositoryLabel} />
			<TableCell rowPadding={rowPadding} value={row.leadLabel} />
			<td className={cn(rowPadding, "truncate align-middle text-zinc-500")}>
				<time dateTime={row.project.createdAt}>{row.createdLabel}</time>
			</td>
		</tr>
	);
}

function TableCell({
	className,
	rowPadding,
	value,
}: {
	className?: string;
	rowPadding: string;
	value: string;
}): ReactElement {
	return (
		<td
			className={cn(
				rowPadding,
				"truncate align-middle text-zinc-400",
				className,
			)}
		>
			{value}
		</td>
	);
}

function resolveProjectTableState({
	error,
	isLoading,
	rowCount,
	searchQuery,
	totalCount,
}: {
	error: Error | null;
	isLoading: boolean;
	rowCount: number;
	searchQuery: string;
	totalCount: number;
}): string | null {
	if (isLoading) {
		return "Loading projects";
	}
	if (error) {
		return error.message;
	}
	if (totalCount === 0) {
		return "No projects yet";
	}
	if (rowCount === 0 && searchQuery.trim()) {
		return "No projects match this search";
	}
	return null;
}
