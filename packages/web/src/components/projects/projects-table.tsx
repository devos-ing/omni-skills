"use client";

import { Pencil, Pin, PinOff } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Typography } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import type { ProjectDisplayRow } from "./types/projects-panel.types";

const PROJECT_TABLE_COLUMN_COUNT = 7;

interface ProjectsTableProps {
	error: Error | null;
	isLoading: boolean;
	rows: ProjectDisplayRow[];
	searchQuery: string;
	totalCount: number;
	onEditProject: (row: ProjectDisplayRow) => void;
	onToggleProjectPin: (row: ProjectDisplayRow) => void;
}

export function ProjectsTable({
	error,
	isLoading,
	rows,
	searchQuery,
	totalCount,
	onEditProject,
	onToggleProjectPin,
}: ProjectsTableProps): ReactElement {
	const rowPadding = "px-4 py-4";
	const stateLabel = resolveProjectTableState({
		error,
		isLoading,
		rowCount: rows.length,
		searchQuery,
		totalCount,
	});

	return (
		<section className="min-h-0 overflow-hidden bg-card">
			<div className="h-full overflow-x-auto">
				<table className="h-full w-full min-w-[60rem] table-fixed border-collapse">
					<colgroup>
						<col className="w-[27%]" />
						<col className="w-[9%]" />
						<col className="w-[13%]" />
						<col className="w-[18%]" />
						<col className="w-[11%]" />
						<col className="w-[10%]" />
						<col className="w-[12%]" />
					</colgroup>
					<thead className="sticky top-0 z-10 bg-surface-panel text-left text-xs font-medium text-muted-foreground">
						<tr className="border-b border-border">
							<TableHeaderCell label="Name" />
							<TableHeaderCell label="Priority" />
							<TableHeaderCell label="Category" />
							<TableHeaderCell label="Repository" />
							<TableHeaderCell label="Lead" />
							<TableHeaderCell label="Created" />
							<TableHeaderCell label="" />
						</tr>
					</thead>
					<tbody className="text-sm text-zinc-300">
						{stateLabel ? (
							<tr>
								<Typography
									as="td"
									className="h-72 px-4 text-center"
									colSpan={PROJECT_TABLE_COLUMN_COUNT}
									variant="description"
								>
									{stateLabel}
								</Typography>
							</tr>
						) : (
							rows.map((row) => (
								<ProjectTableRow
									key={row.project.id}
									onEditProject={onEditProject}
									onToggleProjectPin={onToggleProjectPin}
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
		<Typography
			as="th"
			className="h-10 whitespace-nowrap px-4 align-middle"
			variant="tableHeader"
		>
			{label}
		</Typography>
	);
}

function ProjectTableRow({
	onEditProject,
	onToggleProjectPin,
	row,
	rowPadding,
}: {
	onEditProject: (row: ProjectDisplayRow) => void;
	onToggleProjectPin: (row: ProjectDisplayRow) => void;
	row: ProjectDisplayRow;
	rowPadding: string;
}): ReactElement {
	const PinIcon = row.project.isPinned ? PinOff : Pin;
	const pinLabel = row.project.isPinned
		? `Unpin ${row.project.name}`
		: `Pin ${row.project.name}`;

	return (
		<tr className="border-b border-border/80 last:border-b-0 hover:bg-surface-hover/60">
			<td className={cn(rowPadding, "align-middle")}>
				<div className="flex min-w-0 items-center gap-3">
					<span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-surface-input text-xl">
						{row.emojiLabel}
					</span>
					<div className="min-w-0">
						<Typography className="truncate text-base" variant="cardTitle">
							{row.project.name}
						</Typography>
						<Typography className="truncate" variant="muted">
							{row.summaryLabel}
						</Typography>
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
			<Typography
				as="td"
				className={cn(rowPadding, "truncate align-middle")}
				variant="description"
			>
				<Typography
					as="time"
					dateTime={row.project.createdAt}
					variant="description"
				>
					{row.createdLabel}
				</Typography>
			</Typography>
			<td className={cn(rowPadding, "align-middle")}>
				<div className="flex items-center justify-end gap-1">
					<Button
						aria-label={pinLabel}
						onClick={() => onToggleProjectPin(row)}
						size="icon"
						title={pinLabel}
						type="button"
						variant="ghost"
					>
						<PinIcon size={15} />
					</Button>
					<Button
						aria-label={`Edit ${row.project.name}`}
						onClick={() => onEditProject(row)}
						size="sm"
						type="button"
						variant="ghost"
					>
						<Pencil size={15} />
						Edit
					</Button>
				</div>
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
		<Typography
			as="td"
			className={cn(rowPadding, "truncate align-middle", className)}
			variant="tableCell"
		>
			{value}
		</Typography>
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
	if (isLoading) return "Loading projects";
	if (error) return error.message;
	if (totalCount === 0) return "No projects yet";
	if (rowCount === 0 && searchQuery.trim())
		return "No projects match this search";
	return null;
}
