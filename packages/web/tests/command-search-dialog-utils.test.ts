import { describe, expect, it } from "bun:test";

import {
	buildCommandSearchGroups,
	commandSearchDraftText,
} from "../src/components/web-shell/command-search-dialog-utils";
import { navItems } from "../src/components/web-shell/web-shell.constants";
import type {
	CommandHistoryRecord,
	ProjectBoardTaskRecord,
} from "../src/lib/api";

const commandHistory: CommandHistoryRecord[] = [
	{
		id: "history-1",
		command: "bun test",
		exitCode: 0,
		executedAt: "2026-05-25T00:00:00.000Z",
	},
];

const tasks: ProjectBoardTaskRecord[] = [
	{
		id: "task-1",
		taskKey: "TASK-1",
		projectId: "project-1",
		title: "Wire search palette",
		content: "Show slash commands from search",
		priority: 1,
		status: "todo",
		dueDate: null,
		creatorId: "user-1",
		assigneeId: null,
		linkedPr: null,
		linearIssueId: null,
		linearIdentifier: null,
		linearUrl: null,
		createdAt: "2026-05-25T00:00:00.000Z",
		updatedAt: "2026-05-25T00:00:00.000Z",
	},
];

describe("command search groups", () => {
	it("shows slash commands immediately on an empty query", () => {
		const groups = buildCommandSearchGroups({
			commandHistory,
			navItems,
			query: "",
			tasks,
		});

		expect(groups.map((group) => group.id)).toEqual(["commands"]);
		expect(groups[0]?.results.map((result) => result.label)).toEqual([
			"/new",
			"/project",
			"/run",
			"/status",
			"/skills",
			"/onboard",
		]);
	});

	it("filters slash commands by name and hint", () => {
		expect(
			buildCommandSearchGroups({
				commandHistory,
				navItems,
				query: "skills",
				tasks,
			})[0]?.results.map((result) => result.label),
		).toEqual(["/skills"]);

		expect(
			buildCommandSearchGroups({
				commandHistory,
				navItems,
				query: "onboarding",
				tasks,
			})[0]?.results.map((result) => result.label),
		).toEqual(["/onboard"]);
	});

	it("maps a selected slash command to a composer draft", () => {
		expect(commandSearchDraftText("/status")).toBe("/status ");
	});
});
