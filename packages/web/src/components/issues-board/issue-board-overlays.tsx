"use client";

import type { ReactElement } from "react";

import { TaskCreateChatDialog } from "@/components/task-create/task-create-chat-dialog";
import type { ProjectBoardTaskRecord, TaskMutationRequest } from "@/lib/api";

import { IssueCardContextMenu } from "./issue-card-context-menu";
import { IssueDialog } from "./issue-dialog";
import type {
	IssueContextMenuState,
	IssueDialogState,
	IssueQuickUpdate,
} from "./issues-board.types";

interface IssueBoardOverlaysProps {
	contextMenu: IssueContextMenuState | null;
	dialog: IssueDialogState;
	dialogStatus: string;
	errorMessage: string | null;
	isChatDialogOpen: boolean;
	isSaving: boolean;
	onCloseChatDialog: () => void;
	onCloseDialog: () => void;
	onCloseMenu: () => void;
	onCopyLink: (task: ProjectBoardTaskRecord) => void;
	onDeleteIssue: (task: ProjectBoardTaskRecord) => void;
	onPinIssue: (task: ProjectBoardTaskRecord) => void;
	onSubmitDialog: (input: TaskMutationRequest) => Promise<void>;
	onUpdateIssue: (
		task: ProjectBoardTaskRecord,
		update: IssueQuickUpdate,
	) => void;
}

export function IssueBoardOverlays({
	contextMenu,
	dialog,
	dialogStatus,
	errorMessage,
	isChatDialogOpen,
	isSaving,
	onCloseChatDialog,
	onCloseDialog,
	onCloseMenu,
	onCopyLink,
	onDeleteIssue,
	onPinIssue,
	onSubmitDialog,
	onUpdateIssue,
}: IssueBoardOverlaysProps): ReactElement {
	return (
		<>
			{contextMenu ? (
				<IssueCardContextMenu
					task={contextMenu.task}
					x={contextMenu.x}
					y={contextMenu.y}
					onClose={onCloseMenu}
					onCopyLink={onCopyLink}
					onDeleteIssue={onDeleteIssue}
					onPinIssue={onPinIssue}
					onUpdateIssue={onUpdateIssue}
				/>
			) : null}
			{dialog ? (
				<IssueDialog
					defaultStatus={dialogStatus}
					errorMessage={errorMessage}
					isDeleting={false}
					isSaving={isSaving}
					mode={dialog.mode}
					onClose={onCloseDialog}
					onSubmit={onSubmitDialog}
					projectId={dialog.mode === "edit" ? dialog.task.projectId : null}
					task={dialog.mode === "edit" ? dialog.task : undefined}
				/>
			) : null}
			{isChatDialogOpen ? (
				<TaskCreateChatDialog
					defaultBoardProjectId=""
					key="all-issues-task-create"
					onClose={onCloseChatDialog}
				/>
			) : null}
		</>
	);
}
