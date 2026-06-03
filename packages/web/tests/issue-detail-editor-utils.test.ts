import { describe, expect, it } from "bun:test";

import {
	createDetailDraft,
	createSaveRequest,
} from "../src/components/issues-board/issue-detail-editor-utils";
import type { ProjectBoardTaskRecord } from "../src/lib/api";

describe("issue detail editor utilities", () => {
	it("normalizes existing task status values for the issue status picker", () => {
		expect(createDetailDraft(buildTask({ status: "plan" })).status).toBe(
			"todo",
		);
		expect(createDetailDraft(buildTask({ status: "in_progress" })).status).toBe(
			"running",
		);
	});

	it("allows saving tasks with empty description content", () => {
		const result = createSaveRequest(
			{
				title: "Title only task",
				content: "",
				priority: "1",
				status: "planning",
				creatorId: "member-1",
				dueDate: "",
				linkedPr: "",
			},
			null,
		);

		expect(result).toEqual({
			ok: true,
			value: {
				projectId: null,
				title: "Title only task",
				content: "",
				priority: 1,
				status: "planning",
				creatorId: "member-1",
				dueDate: null,
				linkedPr: null,
			},
		});
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
