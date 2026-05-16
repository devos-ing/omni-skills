"use client";

import { Columns3, Filter, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactElement, useEffect, useMemo, useState } from "react";

import { TaskCreateChatDialog } from "@/components/task-create/task-create-chat-dialog";
import type { ProjectBoardTaskRecord, TaskMutationRequest } from "@/lib/api";
import {
	useBoardTasksQuery,
	useCreateBoardTaskMutation,
	useUpdateBoardTaskMutation,
} from "@/lib/api/queries";

import { IssueDialog } from "./issue-dialog";
import {
	BoardContent,
	BoardHeader,
	ColumnToggles,
	ToolButton,
} from "./issues-board-parts";
import {
	buildStatusColumns,
	filterTaskByTab,
	matchesSearch,
	sortColumns,
	toggleAllColumns,
	toggleStatus,
} from "./issues-board-utils";
import { STATUS_ORDER } from "./issues-board.constants";
import type {
	IssueDialogState,
	IssueDragState,
	IssueTab,
} from "./issues-board.types";

interface IssuesBoardProps {
	createIssueRequest: number;
}

export function IssuesBoard({
	createIssueRequest,
}: IssuesBoardProps): ReactElement {
	const router = useRouter();
	const [activeTab, setActiveTab] = useState<IssueTab>("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [sortNewestFirst, setSortNewestFirst] = useState(true);
	const [visibleStatuses, setVisibleStatuses] = useState<string[]>([
		...STATUS_ORDER,
	]);
	const [dialog, setDialog] = useState<IssueDialogState>(null);
	const [dragState, setDragState] = useState<IssueDragState | null>(null);
	const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
	const [dragError, setDragError] = useState<string | null>(null);
	const [isChatDialogOpen, setIsChatDialogOpen] = useState(false);
	const [mutationError, setMutationError] = useState<string | null>(null);

	const tasksQuery = useBoardTasksQuery();
	const createTask = useCreateBoardTaskMutation();
	const updateTask = useUpdateBoardTaskMutation();

	useEffect(() => {
		if (createIssueRequest > 0) {
			setIsChatDialogOpen(true);
		}
	}, [createIssueRequest]);

	const columns = useMemo(() => {
		return sortColumns(buildStatusColumns(tasksQuery.data ?? []))
			.filter((column) => visibleStatuses.includes(column.status))
			.map((column) => ({
				...column,
				tasks: column.tasks
					.filter((task) => filterTaskByTab(task, activeTab))
					.filter((task) => matchesSearch(task, searchQuery))
					.sort((left, right) =>
						sortNewestFirst
							? right.createdAt.localeCompare(left.createdAt)
							: left.createdAt.localeCompare(right.createdAt),
					),
			}));
	}, [
		activeTab,
		searchQuery,
		sortNewestFirst,
		tasksQuery.data,
		visibleStatuses,
	]);

	const taskCount = columns.reduce(
		(sum, column) => sum + column.tasks.length,
		0,
	);
	const dialogStatus =
		dialog?.mode === "create"
			? dialog.status
			: (dialog?.task.status ?? "planning");

	function openTaskDetail(taskId: string): void {
		router.push(`/issues/${encodeURIComponent(taskId)}`);
	}

	function startTaskDrag(task: ProjectBoardTaskRecord): void {
		setDragError(null);
		setDragState({ taskId: task.id, status: task.status });
	}

	function endTaskDrag(): void {
		setDragState(null);
		setDragOverStatus(null);
	}

	function enterDropStatus(status: string): void {
		if (!dragState || dragState.status === status) {
			return;
		}
		setDragOverStatus(status);
	}

	function leaveDropStatus(status: string): void {
		setDragOverStatus((current) => (current === status ? null : current));
	}

	async function dropTaskOnStatus(status: string): Promise<void> {
		if (!dragState || dragState.status === status) {
			endTaskDrag();
			return;
		}
		await moveTaskToStatus(dragState.taskId, dragState.status, status);
		endTaskDrag();
	}

	async function dropTaskFromPointer(
		task: ProjectBoardTaskRecord,
		status: string,
	): Promise<void> {
		await moveTaskToStatus(task.id, task.status, status);
	}

	async function moveTaskToStatus(
		taskId: string,
		currentStatus: string,
		status: string,
	): Promise<void> {
		if (currentStatus === status) {
			return;
		}
		setDragError(null);
		try {
			await updateTask.mutateAsync({
				taskId,
				task: { status },
			});
		} catch (error) {
			setDragError(error instanceof Error ? error.message : "Task move failed");
		}
	}

	async function submitDialog(input: TaskMutationRequest): Promise<void> {
		setMutationError(null);
		try {
			if (dialog?.mode === "edit") {
				await updateTask.mutateAsync({ taskId: dialog.task.id, task: input });
			} else {
				await createTask.mutateAsync(input);
			}
			setDialog(null);
		} catch (error) {
			setMutationError(error instanceof Error ? error.message : "Save failed");
		}
	}

	return (
		<section className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#0f1013] text-zinc-100">
			<BoardHeader
				activeTab={activeTab}
				onTabChange={setActiveTab}
				onCreateIssue={() => setIsChatDialogOpen(true)}
			/>
			<div className="flex flex-wrap items-center gap-3 border-b border-zinc-900 px-5 py-3">
				<input
					aria-label="Search issues"
					className="issue-input h-9 min-w-52 flex-1"
					onChange={(event) => setSearchQuery(event.target.value)}
					placeholder="Search issues"
					value={searchQuery}
				/>
				<ToolButton
					icon={<Filter size={16} />}
					label={`${taskCount} shown`}
					onClick={() => setActiveTab("all")}
				/>
				<ToolButton
					icon={<SlidersHorizontal size={16} />}
					label={sortNewestFirst ? "Newest" : "Oldest"}
					onClick={() => setSortNewestFirst((value) => !value)}
				/>
				<ToolButton
					icon={<Columns3 size={16} />}
					label="Columns"
					onClick={() => toggleAllColumns(visibleStatuses, setVisibleStatuses)}
				/>
			</div>
			<ColumnToggles
				visibleStatuses={visibleStatuses}
				onToggle={(status) => toggleStatus(status, setVisibleStatuses)}
			/>
			<BoardContent
				columns={columns}
				dragError={dragError}
				dragOverStatus={dragOverStatus}
				dragState={dragState}
				error={tasksQuery.error}
				isLoading={tasksQuery.isLoading}
				onDropStatusEnter={enterDropStatus}
				onDropStatusLeave={leaveDropStatus}
				onCreateIssue={(status) => setDialog({ mode: "create", status })}
				onOpenIssue={(task) => openTaskDetail(task.id)}
				onTaskDragEnd={endTaskDrag}
				onTaskDragStart={startTaskDrag}
				onTaskDrop={(status) => void dropTaskOnStatus(status)}
				onTaskPointerDrop={(task, status) =>
					void dropTaskFromPointer(task, status)
				}
			/>
			{dialog ? (
				<IssueDialog
					defaultStatus={dialogStatus}
					errorMessage={mutationError}
					isDeleting={false}
					isSaving={createTask.isPending || updateTask.isPending}
					mode={dialog.mode}
					onClose={() => setDialog(null)}
					onSubmit={submitDialog}
					projectId={dialog.mode === "edit" ? dialog.task.projectId : null}
					task={dialog.mode === "edit" ? dialog.task : undefined}
				/>
			) : null}
			{isChatDialogOpen ? (
				<TaskCreateChatDialog
					defaultBoardProjectId=""
					key="all-issues-task-create"
					onClose={() => setIsChatDialogOpen(false)}
				/>
			) : null}
		</section>
	);
}
