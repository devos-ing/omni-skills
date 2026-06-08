"use client";

import type { ReactElement } from "react";

import type { ProjectBoardTaskRecord } from "@/lib/api";

import { IssueCardContextMenu } from "./issue-card-context-menu";
import { IssueTaskDetailPanel } from "./issue-task-detail-panel";
import { IssueWorkflowRunPanel } from "./issue-workflow-run-panel";
import type {
	IssueContextMenuState,
	IssueQuickUpdate,
} from "./types/issues-board.types";
import type { IssueWorkflowRunController } from "./use-issue-workflow-run";

interface IssueBoardOverlaysProps {
	contextMenu: IssueContextMenuState | null;
	selectedDetailTaskId: string | null;
	onCloseDetailPanel: () => void;
	onCloseMenu: () => void;
	onCopyLink: (task: ProjectBoardTaskRecord) => void;
	onDeleteIssue: (task: ProjectBoardTaskRecord) => void;
	onPinIssue: (task: ProjectBoardTaskRecord) => void;
	workflowRun: IssueWorkflowRunController;
	onUpdateIssue: (
		task: ProjectBoardTaskRecord,
		update: IssueQuickUpdate,
	) => void;
}

export function IssueBoardOverlays({
	contextMenu,
	selectedDetailTaskId,
	onCloseDetailPanel,
	onCloseMenu,
	onCopyLink,
	onDeleteIssue,
	onPinIssue,
	workflowRun,
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
					onRunIssue={(task) => void workflowRun.runIssue(task)}
					onUpdateIssue={onUpdateIssue}
				/>
			) : null}
			<IssueTaskDetailPanel
				taskId={selectedDetailTaskId}
				onClose={onCloseDetailPanel}
			/>
			<IssueWorkflowRunPanel
				runState={workflowRun.state}
				onClose={workflowRun.clearRunState}
			/>
		</>
	);
}
