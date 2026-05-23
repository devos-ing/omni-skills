"use client";

import { useRouter } from "next/navigation";
import { type ReactElement, useEffect, useMemo, useState } from "react";

import type { ProjectBoardTaskRecord, TaskMutationRequest } from "@/lib/api";
import {
	useBoardTasksQuery,
	useCreateBoardTaskMutation,
	useUpdateBoardTaskMutation,
} from "@/lib/api/queries";

import { IssueBoardOverlays } from "./issue-board-overlays";
import {
	BoardContent,
	BoardHeader,
	BoardToolbar,
	ColumnToggles,
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
	IssueContextMenuState,
	IssueDialogState,
	IssueDragState,
	IssueTab,
} from "./issues-board.types";
import { useIssueBoardTaskActions } from "./use-issue-board-task-actions";
import { useIssueWorkflowRun } from "./use-issue-workflow-run";

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
	const [contextMenu, setContextMenu] = useState<IssueContextMenuState | null>(
		null,
	);
	const [isChatDialogOpen, setIsChatDialogOpen] = useState(false);
	const [mutationError, setMutationError] = useState<string | null>(null);

	const tasksQuery = useBoardTasksQuery();
	const createTask = useCreateBoardTaskMutation();
	const updateTask = useUpdateBoardTaskMutation();
	const workflowRun = useIssueWorkflowRun();
	const { copyIssueLink, deleteIssue, pinIssueToSidebar, updateIssue } =
		useIssueBoardTaskActions(setDragError);

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

	function openIssueMenu(
		task: ProjectBoardTaskRecord,
		position: { x: number; y: number },
	): void {
		setContextMenu({ task, ...position });
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
			<BoardToolbar
				searchQuery={searchQuery}
				sortNewestFirst={sortNewestFirst}
				taskCount={taskCount}
				onSearchChange={setSearchQuery}
				onShowAll={() => setActiveTab("all")}
				onToggleColumns={() =>
					toggleAllColumns(visibleStatuses, setVisibleStatuses)
				}
				onToggleSort={() => setSortNewestFirst((value) => !value)}
			/>
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
				onOpenIssueMenu={openIssueMenu}
				onTaskDragEnd={endTaskDrag}
				onTaskDragStart={startTaskDrag}
				onTaskDrop={(status) => void dropTaskOnStatus(status)}
				onTaskPointerDrop={(task, status) =>
					void dropTaskFromPointer(task, status)
				}
			/>
			<IssueBoardOverlays
				contextMenu={contextMenu}
				dialog={dialog}
				dialogStatus={dialogStatus}
				errorMessage={mutationError}
				isChatDialogOpen={isChatDialogOpen}
				isSaving={createTask.isPending || updateTask.isPending}
				onCloseChatDialog={() => setIsChatDialogOpen(false)}
				onCloseDialog={() => setDialog(null)}
				onCloseMenu={() => setContextMenu(null)}
				onCopyLink={copyIssueLink}
				onDeleteIssue={(task) => void deleteIssue(task)}
				onPinIssue={pinIssueToSidebar}
				workflowRun={workflowRun}
				onSubmitDialog={submitDialog}
				onUpdateIssue={(task, update) => void updateIssue(task, update)}
			/>
		</section>
	);
}
