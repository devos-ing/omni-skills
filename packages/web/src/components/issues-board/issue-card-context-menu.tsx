"use client";

import { Copy, Pin, PlayCircle, Trash2 } from "lucide-react";
import {
	type ChangeEvent,
	type ReactElement,
	useEffect,
	useState,
} from "react";

import type { ProjectBoardTaskRecord } from "@/lib/api";

import { getStatusLabel, normalizeDueDate } from "./issues-board-utils";
import { STATUS_ORDER } from "./issues-board.constants";
import type { IssuePriority, IssueQuickUpdate } from "./issues-board.types";
import { PriorityDropdown } from "./priority-dropdown";

interface IssueCardContextMenuProps {
	task: ProjectBoardTaskRecord;
	x: number;
	y: number;
	onClose: () => void;
	onCopyLink: (task: ProjectBoardTaskRecord) => void;
	onDeleteIssue: (task: ProjectBoardTaskRecord) => void;
	onPinIssue: (task: ProjectBoardTaskRecord) => void;
	onRunIssue: (task: ProjectBoardTaskRecord) => void;
	onUpdateIssue: (
		task: ProjectBoardTaskRecord,
		update: IssueQuickUpdate,
	) => void;
}

export function IssueCardContextMenu({
	task,
	x,
	y,
	onClose,
	onCopyLink,
	onDeleteIssue,
	onPinIssue,
	onRunIssue,
	onUpdateIssue,
}: IssueCardContextMenuProps): ReactElement {
	const [assigneeDraft, setAssigneeDraft] = useState(task.assigneeId ?? "");
	const [dueDateDraft, setDueDateDraft] = useState(
		task.dueDate ? task.dueDate.slice(0, 10) : "",
	);

	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent): void {
			if (event.key === "Escape") {
				onClose();
			}
		}
		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("scroll", onClose, true);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("scroll", onClose, true);
		};
	}, [onClose]);

	function updateAndClose(update: IssueQuickUpdate): void {
		onUpdateIssue(task, update);
		onClose();
	}

	function changeStatus(event: ChangeEvent<HTMLSelectElement>): void {
		updateAndClose({ status: event.target.value });
	}

	function changePriority(priority: IssuePriority): void {
		updateAndClose({ priority });
	}

	function setAssignee(): void {
		updateAndClose({ assigneeId: assigneeDraft.trim() || null });
	}

	function setDueDate(): void {
		updateAndClose({ dueDate: normalizeDueDate(dueDateDraft) });
	}

	return (
		<button
			aria-label="Close issue menu"
			className="fixed inset-0 z-40 cursor-default bg-transparent text-left"
			onClick={onClose}
			type="button"
		>
			<div
				className="fixed z-50 grid w-64 gap-3 rounded-lg border border-zinc-700 bg-[#18191d] p-3 text-zinc-100 shadow-2xl"
				onClick={(event) => event.stopPropagation()}
				onContextMenu={(event) => event.preventDefault()}
				onKeyDown={(event) => event.stopPropagation()}
				role="menu"
				style={{ left: x, top: y }}
				tabIndex={-1}
			>
				<div className="min-w-0 border-b border-zinc-800 pb-2">
					<p className="m-0 truncate text-xs text-zinc-500">{task.taskKey}</p>
					<p className="m-0 truncate text-sm font-medium">{task.title}</p>
				</div>
				<MenuField label="Status">
					<select
						className="issue-input h-9"
						onChange={changeStatus}
						value={task.status}
					>
						{STATUS_ORDER.map((status) => (
							<option key={status} value={status}>
								{getStatusLabel(status)}
							</option>
						))}
					</select>
				</MenuField>
				<MenuField label="Priority">
					<PriorityDropdown
						className="h-9"
						value={task.priority}
						onChange={changePriority}
					/>
				</MenuField>
				<MenuField label="Assignee">
					<div className="flex gap-2">
						<input
							className="issue-input h-9 min-w-0 flex-1"
							onChange={(event) => setAssigneeDraft(event.target.value)}
							value={assigneeDraft}
						/>
						<button
							className="issue-secondary-button h-9 px-2"
							onClick={setAssignee}
							type="button"
						>
							Set
						</button>
					</div>
				</MenuField>
				<MenuField label="Due date">
					<div className="flex gap-2">
						<input
							className="issue-input h-9 min-w-0 flex-1"
							onChange={(event) => setDueDateDraft(event.target.value)}
							type="date"
							value={dueDateDraft}
						/>
						<button
							className="issue-secondary-button h-9 px-2"
							onClick={setDueDate}
							type="button"
						>
							Set
						</button>
					</div>
				</MenuField>
				<div className="grid gap-1 border-t border-zinc-800 pt-2">
					<MenuButton
						icon={<PlayCircle size={14} />}
						label="Run workflow"
						onClick={() => {
							onRunIssue(task);
							onClose();
						}}
					/>
					<MenuButton
						icon={<Pin size={14} />}
						label="Pin to sidebar"
						onClick={() => {
							onPinIssue(task);
							onClose();
						}}
					/>
					<MenuButton
						icon={<Copy size={14} />}
						label="Copy link"
						onClick={() => {
							onCopyLink(task);
							onClose();
						}}
					/>
					<MenuButton
						danger
						icon={<Trash2 size={14} />}
						label="Delete issue"
						onClick={() => {
							onDeleteIssue(task);
							onClose();
						}}
					/>
				</div>
			</div>
		</button>
	);
}

function MenuField({
	children,
	label,
}: {
	children: ReactElement;
	label: string;
}): ReactElement {
	return (
		<div className="grid gap-1 text-xs text-zinc-500">
			<span>{label}</span>
			{children}
		</div>
	);
}

function MenuButton({
	danger = false,
	icon,
	label,
	onClick,
}: {
	danger?: boolean;
	icon: ReactElement;
	label: string;
	onClick: () => void;
}): ReactElement {
	return (
		<button
			className={`flex h-8 items-center gap-2 rounded-md px-2 text-sm ${
				danger
					? "text-red-300 hover:bg-red-950/40"
					: "text-zinc-300 hover:bg-zinc-800"
			}`}
			onClick={onClick}
			type="button"
		>
			{icon}
			<span>{label}</span>
		</button>
	);
}
