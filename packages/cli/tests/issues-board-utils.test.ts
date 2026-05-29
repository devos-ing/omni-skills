import { describe, expect, it } from "bun:test";
import {
	buildStatusColumns,
	getStatusLabel,
} from "../../web/src/components/issues-board/issues-board-utils";
import type { ProjectBoardTaskRecord } from "../../web/src/lib/api";

describe("issues board status utilities", () => {
	it("groups legacy PR-created tasks into in_review", () => {
		const columns = buildStatusColumns([
			task({ id: "task-1", status: "pr_created" }),
		]);

		expect(columns.map((column) => column.status)).not.toContain("pr_created");
		expect(
			columns.find((column) => column.status === "in_review")?.tasks[0]?.status,
		).toBe("in_review");
		expect(getStatusLabel("pr_created")).toBe("In Review");
	});
});

function task(input: { id: string; status: string }): ProjectBoardTaskRecord {
	return {
		id: input.id,
		taskKey: "TASK-000001",
		projectId: "project-1",
		title: "Task",
		content: "Task content",
		priority: 1,
		status: input.status,
		dueDate: null,
		creatorId: "member-1",
		assigneeId: null,
		linkedPr: null,
		createdAt: "2026-05-16T00:00:00.000Z",
		updatedAt: "2026-05-16T00:00:00.000Z",
	};
}
