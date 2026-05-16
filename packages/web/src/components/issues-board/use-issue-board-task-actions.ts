"use client";

import type { Dispatch, SetStateAction } from "react";

import type { ProjectBoardTaskRecord } from "@/lib/api";
import {
	useDeleteBoardTaskMutation,
	useUpdateBoardTaskMutation,
} from "@/lib/api/queries";
import { useUiStore } from "@/lib/ui-store";

import type { IssueQuickUpdate } from "./issues-board.types";

export function useIssueBoardTaskActions(
	setError: Dispatch<SetStateAction<string | null>>,
): {
	copyIssueLink: (task: ProjectBoardTaskRecord) => void;
	deleteIssue: (task: ProjectBoardTaskRecord) => Promise<void>;
	pinIssueToSidebar: (task: ProjectBoardTaskRecord) => void;
	updateIssue: (
		task: ProjectBoardTaskRecord,
		update: IssueQuickUpdate,
	) => Promise<void>;
} {
	const pinIssue = useUiStore((state) => state.pinIssue);
	const unpinIssue = useUiStore((state) => state.unpinIssue);
	const updateTask = useUpdateBoardTaskMutation();
	const deleteTask = useDeleteBoardTaskMutation();

	async function updateIssue(
		task: ProjectBoardTaskRecord,
		update: IssueQuickUpdate,
	): Promise<void> {
		setError(null);
		try {
			await updateTask.mutateAsync({ taskId: task.id, task: update });
		} catch (error) {
			setError(error instanceof Error ? error.message : "Issue update failed");
		}
	}

	function pinIssueToSidebar(task: ProjectBoardTaskRecord): void {
		pinIssue({ id: task.id, taskKey: task.taskKey, title: task.title });
	}

	function copyIssueLink(task: ProjectBoardTaskRecord): void {
		const href = new URL(
			`/issues/${encodeURIComponent(task.id)}`,
			window.location.href,
		).toString();
		void navigator.clipboard?.writeText(href);
	}

	async function deleteIssue(task: ProjectBoardTaskRecord): Promise<void> {
		if (!window.confirm(`Delete issue ${task.taskKey}?`)) {
			return;
		}
		setError(null);
		try {
			await deleteTask.mutateAsync(task.id);
			unpinIssue(task.id);
		} catch (error) {
			setError(error instanceof Error ? error.message : "Issue delete failed");
		}
	}

	return {
		copyIssueLink,
		deleteIssue,
		pinIssueToSidebar,
		updateIssue,
	};
}
