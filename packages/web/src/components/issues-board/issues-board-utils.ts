import type {
	ProjectBoardStatusColumn,
	ProjectBoardTaskRecord,
} from "../../lib/api";

import {
	PRIORITY_OPTIONS,
	STATUS_ORDER,
	STATUS_PRESENTATION,
} from "./issues-board.constants";
import type { IssueDraft, IssueTab } from "./issues-board.types";

const LEGACY_PR_CREATED_STATUS = "pr_created";

export function getStatusLabel(status: string): string {
	const normalized = normalizeBoardStatus(status);
	return STATUS_PRESENTATION[normalized]?.label ?? normalized;
}

export function getPriorityLabel(priority: number): string {
	return (
		PRIORITY_OPTIONS.find((option) => option.value === priority)?.label ??
		`P${priority}`
	);
}

export function isAgentTask(task: ProjectBoardTaskRecord): boolean {
	const haystack =
		`${task.creatorId} ${task.title} ${task.content}`.toLowerCase();
	return /\bagent\b|codex|claude|autopilot|bot/.test(haystack);
}

export function filterTaskByTab(
	task: ProjectBoardTaskRecord,
	tab: IssueTab,
): boolean {
	if (tab === "all") {
		return true;
	}
	const agentTask = isAgentTask(task);
	return tab === "agents" ? agentTask : !agentTask;
}

export function matchesSearch(
	task: ProjectBoardTaskRecord,
	query: string,
): boolean {
	const normalized = query.trim().toLowerCase();
	if (!normalized) {
		return true;
	}
	return `${task.id} ${task.title} ${task.content} ${task.creatorId}`
		.toLowerCase()
		.includes(normalized);
}

export function toggleStatus(
	status: string,
	setVisibleStatuses: (updater: (current: string[]) => string[]) => void,
): void {
	setVisibleStatuses((current) =>
		current.includes(status)
			? current.filter((item) => item !== status)
			: [...current, status],
	);
}

export function toggleAllColumns(
	visibleStatuses: string[],
	setVisibleStatuses: (updater: (current: string[]) => string[]) => void,
): void {
	setVisibleStatuses(() =>
		visibleStatuses.length === STATUS_ORDER.length
			? ["planning"]
			: [...STATUS_ORDER],
	);
}

export function createEmptyDraft(status: string): IssueDraft {
	return {
		title: "",
		content: "",
		priority: "1",
		status: normalizeBoardStatus(status),
		dueDate: "",
		linkedPr: "",
		creatorId: "member-1",
	};
}

export function createDraftFromTask(task: ProjectBoardTaskRecord): IssueDraft {
	return {
		title: task.title,
		content: task.content,
		priority: String(task.priority),
		status: normalizeBoardStatus(task.status),
		dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
		linkedPr: task.linkedPr ?? "",
		creatorId: task.creatorId,
	};
}

export function normalizeDueDate(value: string): string | null {
	return value.trim().length === 0 ? null : new Date(value).toISOString();
}

export function sortColumns(
	columns: ProjectBoardStatusColumn[],
): ProjectBoardStatusColumn[] {
	return [...columns].sort((left, right) => {
		const leftIndex = STATUS_ORDER.indexOf(
			left.status as (typeof STATUS_ORDER)[number],
		);
		const rightIndex = STATUS_ORDER.indexOf(
			right.status as (typeof STATUS_ORDER)[number],
		);
		return normalizeIndex(leftIndex) - normalizeIndex(rightIndex);
	});
}

export function buildStatusColumns(
	tasks: ProjectBoardTaskRecord[],
): ProjectBoardStatusColumn[] {
	const columns = new Map<string, ProjectBoardTaskRecord[]>();
	for (const task of tasks) {
		const status = normalizeBoardStatus(task.status);
		const items = columns.get(status) ?? [];
		items.push({ ...task, status });
		columns.set(status, items);
	}
	const knownColumns = STATUS_ORDER.map((status) => ({
		status,
		tasks: columns.get(status) ?? [],
	}));
	const extraColumns = [...columns.entries()]
		.filter(([status]) => !(STATUS_ORDER as readonly string[]).includes(status))
		.map(([status, items]) => ({ status, tasks: items }));
	return [...knownColumns, ...extraColumns];
}

function normalizeIndex(index: number): number {
	return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

export function normalizeBoardStatus(status: string): string {
	return status === LEGACY_PR_CREATED_STATUS ? "reviewing" : status;
}
