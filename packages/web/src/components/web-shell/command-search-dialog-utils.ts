import type { CommandHistoryRecord, ProjectBoardTaskRecord } from "@/lib/api";

import { CHAT_COMMANDS } from "@/components/chat-room/chat-command-utils";
import { getStatusLabel } from "@/components/issues-board/issues-board-utils";

import type {
	CommandSearchGroup,
	CommandSearchResult,
} from "./types/command-search-dialog.types";
import type { SidebarNavItem } from "./types/web-shell.types";

const MAX_ISSUE_RESULTS = 8;
const MAX_HISTORY_RESULTS = 6;

export function buildCommandSearchGroups({
	commandHistory,
	navItems,
	query,
	tasks,
}: {
	commandHistory: CommandHistoryRecord[] | undefined;
	navItems: SidebarNavItem[];
	query: string;
	tasks: ProjectBoardTaskRecord[] | undefined;
}): CommandSearchGroup[] {
	const normalizedQuery = normalizeSearchText(query);
	const commandGroup: CommandSearchGroup = {
		id: "commands",
		label: "Commands",
		results: filterResults(
			CHAT_COMMANDS.map(buildChatCommandResult),
			normalizedQuery,
		),
	};
	if (!normalizedQuery) {
		return commandGroup.results.length > 0 ? [commandGroup] : [];
	}
	return [
		commandGroup,
		{
			id: "workspace",
			label: "Workspace",
			results: filterResults(
				[buildNewIssueAction(), ...navItems.map(buildNavigationResult)],
				normalizedQuery,
			),
		},
		{
			id: "issues",
			label: "Issues",
			results: filterResults(
				(tasks ?? []).map(buildIssueResult),
				normalizedQuery,
			).slice(0, MAX_ISSUE_RESULTS),
		},
		{
			id: "history",
			label: "Recent Commands",
			results: filterResults(
				(commandHistory ?? []).map(buildHistoryResult),
				normalizedQuery,
			).slice(0, MAX_HISTORY_RESULTS),
		},
	].filter((group) => group.results.length > 0);
}

export function commandSearchDraftText(command: string): string {
	return `${command} `;
}

function buildChatCommandResult(
	item: (typeof CHAT_COMMANDS)[number],
): CommandSearchResult {
	return {
		id: `chat-command:${item.command}`,
		kind: "chatCommand",
		label: item.command,
		detail: item.hint,
		command: item.command,
		hint: item.hint,
	};
}

function buildNewIssueAction(): CommandSearchResult {
	return {
		id: "action:new-issue",
		kind: "action",
		label: "New Issue",
		detail: "Create an issue",
		action: "newIssue",
	};
}

function buildNavigationResult(item: SidebarNavItem): CommandSearchResult {
	return {
		id: `nav:${item.key}`,
		kind: "navigation",
		label: item.label,
		detail: "Open section",
		navKey: item.key,
	};
}

function buildIssueResult(task: ProjectBoardTaskRecord): CommandSearchResult {
	return {
		id: `issue:${task.id}`,
		kind: "issue",
		label: task.title,
		detail: `${task.id} · ${getStatusLabel(task.status)} · P${task.priority}`,
		task,
	};
}

function buildHistoryResult(record: CommandHistoryRecord): CommandSearchResult {
	return {
		id: `history:${record.id}`,
		kind: "history",
		label: record.command,
		detail: `Copy command · exit ${record.exitCode}`,
		command: record.command,
	};
}

function filterResults(
	results: CommandSearchResult[],
	normalizedQuery: string,
): CommandSearchResult[] {
	if (!normalizedQuery) {
		return results;
	}
	return results.filter((result) => resultMatches(result, normalizedQuery));
}

function resultMatches(
	result: CommandSearchResult,
	normalizedQuery: string,
): boolean {
	return normalizeSearchText(
		`${result.label} ${result.detail} ${extraText(result)}`,
	).includes(normalizedQuery);
}

function extraText(result: CommandSearchResult): string {
	if (result.kind === "chatCommand") {
		return `${result.command} ${result.hint}`;
	}
	if (result.kind === "issue") {
		return `${result.task.id} ${result.task.content} ${result.task.creatorId}`;
	}
	if (result.kind === "history") {
		return result.command;
	}
	if (result.kind === "navigation") {
		return result.navKey;
	}
	return result.action;
}

function normalizeSearchText(value: string): string {
	return value.trim().toLowerCase();
}
