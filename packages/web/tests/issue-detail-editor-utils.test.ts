import { describe, expect, it } from "bun:test";

import { createSaveRequest } from "../src/components/issues-board/issue-detail-editor-utils";

describe("issue detail editor utilities", () => {
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
