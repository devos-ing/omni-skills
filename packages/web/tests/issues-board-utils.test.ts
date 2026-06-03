import { describe, expect, it } from "bun:test";

import {
	buildStatusColumns,
	getStatusLabel,
	normalizeBoardStatus,
} from "../src/components/issues-board/issues-board-utils";
import { STATUS_ORDER } from "../src/components/issues-board/issues-board.constants";
import type { ProjectBoardTaskRecord } from "../src/lib/api";

describe("issues board utilities", () => {
	it("uses the requested issue status columns in order", () => {
		expect([...STATUS_ORDER]).toEqual([
			"backlog",
			"todo",
			"running",
			"in_review",
			"done",
			"canceled",
		]);
	});

	it("normalizes existing task statuses into the six board columns", () => {
		const columns = buildStatusColumns([
			buildTask({ id: "task-plan", status: "plan" }),
			buildTask({ id: "task-progress", status: "in_progress" }),
			buildTask({ id: "task-failed", status: "failed" }),
			buildTask({ id: "task-reviewing", status: "reviewing" }),
		]);

		expect(columns.map((column) => column.status)).toEqual([
			"backlog",
			"todo",
			"running",
			"in_review",
			"done",
			"canceled",
		]);
		expect(columns.find((column) => column.status === "todo")?.tasks).toEqual([
			expect.objectContaining({ id: "task-plan", status: "todo" }),
		]);
		expect(
			columns.find((column) => column.status === "running")?.tasks,
		).toEqual([
			expect.objectContaining({ id: "task-progress", status: "running" }),
		]);
		expect(
			columns.find((column) => column.status === "canceled")?.tasks,
		).toEqual([
			expect.objectContaining({ id: "task-failed", status: "canceled" }),
		]);
		expect(normalizeBoardStatus("todo")).toBe("todo");
		expect(getStatusLabel("running")).toBe("Running");
		expect(getStatusLabel("plan")).toBe("To Do");
	});
});

function buildTask(
	overrides: Partial<ProjectBoardTaskRecord> = {},
): ProjectBoardTaskRecord {
	return {
		id: "task-1",
		taskKey: "TASK-1",
		projectId: "project-1",
		title: "Task",
		content: "Do the work",
		priority: 1,
		status: "backlog",
		dueDate: null,
		creatorId: "member-1",
		assigneeId: null,
		linkedPr: null,
		createdAt: "2026-06-01T00:00:00.000Z",
		updatedAt: "2026-06-01T00:00:00.000Z",
		...overrides,
	};
}
