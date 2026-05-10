import { describe, expect, it } from "bun:test";
import type { LinearIssue } from "../src/core/types";
import {
	buildSplitTaskIssueDescription,
	buildSplitTaskIssueTitle,
	buildTodoIssueFromPlanInput,
	buildWorkflowLabelUpdate,
	isIssueInConfiguredProject,
	isLinearIssueReviewOnlyCandidate,
	isLinearRateLimitError,
	resolveLinearRateLimitDelayMs,
	resolveSplitTaskTeamId,
	shouldSkipDoneStageRegression,
	sortIssuesByPriority,
} from "../src/services/linear";

function createIssue(
	identifier: string,
	priorityValue: number,
	priorityName: string,
	projectId?: string,
): LinearIssue {
	return {
		id: identifier,
		identifier,
		title: identifier,
		url: `https://linear.app/roy/issue/${identifier}`,
		projectId,
		priority: {
			value: priorityValue,
			name: priorityName,
		},
		state: {
			id: "state",
			name: "Todo",
		},
		labels: [],
	};
}

describe("sortIssuesByPriority", () => {
	it("sorts issues from urgent to no priority", () => {
		const issues = [
			createIssue("ROY-4", 4, "Low"),
			createIssue("ROY-0", 0, "No priority"),
			createIssue("ROY-2", 2, "High"),
			createIssue("ROY-1", 1, "Urgent"),
			createIssue("ROY-3", 3, "Medium"),
		];

		const sorted = sortIssuesByPriority(issues);
		expect(sorted.map((issue) => issue.identifier)).toEqual([
			"ROY-1",
			"ROY-2",
			"ROY-3",
			"ROY-4",
			"ROY-0",
		]);
	});

	it("keeps input order for issues with equal priority", () => {
		const issues = [
			createIssue("ROY-10", 2, "High"),
			createIssue("ROY-11", 2, "High"),
			createIssue("ROY-12", 2, "High"),
		];

		const sorted = sortIssuesByPriority(issues);
		expect(sorted.map((issue) => issue.identifier)).toEqual([
			"ROY-10",
			"ROY-11",
			"ROY-12",
		]);
	});

	it("treats unknown priority values like no-priority and keeps stable order", () => {
		const issues = [
			createIssue("ROY-20", 99, "Custom"),
			createIssue("ROY-21", 0, "No priority"),
			createIssue("ROY-22", 2, "High"),
		];

		const sorted = sortIssuesByPriority(issues);
		expect(sorted.map((issue) => issue.identifier)).toEqual([
			"ROY-22",
			"ROY-20",
			"ROY-21",
		]);
	});
});

describe("isIssueInConfiguredProject", () => {
	it("accepts all issues when no project filter is configured", () => {
		expect(isIssueInConfiguredProject("proj_a", undefined)).toBe(true);
		expect(isIssueInConfiguredProject(undefined, undefined)).toBe(true);
	});

	it("accepts only matching project ids when filter is configured", () => {
		expect(isIssueInConfiguredProject("proj_a", "proj_a")).toBe(true);
		expect(isIssueInConfiguredProject("proj_b", "proj_a")).toBe(false);
		expect(isIssueInConfiguredProject(undefined, "proj_a")).toBe(false);
	});
});

describe("isLinearIssueReviewOnlyCandidate", () => {
	it("includes issues in review-related workflow states", () => {
		const issue = createIssue("ROY-70", 2, "High");
		issue.state.id = "state_testing";
		const candidate = isLinearIssueReviewOnlyCandidate(
			issue,
			new Set(["state_pr_created", "state_reviewing", "state_testing"]),
		);
		expect(candidate).toBe(true);
	});

	it("includes issues with testing label even when state does not match", () => {
		const issue = createIssue("ROY-71", 2, "High");
		issue.state.id = "state_other";
		issue.labels = [{ id: "lbl_testing", name: "Testing" }];
		const candidate = isLinearIssueReviewOnlyCandidate(
			issue,
			new Set(["state_pr_created", "state_reviewing", "state_testing"]),
			"Testing",
		);
		expect(candidate).toBe(true);
	});

	it("excludes issues without state or testing label match", () => {
		const issue = createIssue("ROY-72", 2, "High");
		issue.state.id = "state_other";
		issue.labels = [{ id: "lbl_other", name: "Backend" }];
		const candidate = isLinearIssueReviewOnlyCandidate(
			issue,
			new Set(["state_pr_created", "state_reviewing", "state_testing"]),
			"Testing",
		);
		expect(candidate).toBe(false);
	});
});

describe("shouldSkipDoneStageRegression", () => {
	it("prevents moving a done issue back into active workflow stages", () => {
		expect(
			shouldSkipDoneStageRegression("done_id", "implementing", "done_id"),
		).toBe(true);
		expect(shouldSkipDoneStageRegression("done_id", "testing", "done_id")).toBe(
			true,
		);
		expect(shouldSkipDoneStageRegression("done_id", "done", "done_id")).toBe(
			false,
		);
	});

	it("allows active issues to move through workflow stages", () => {
		expect(
			shouldSkipDoneStageRegression(
				"in_progress_id",
				"implementing",
				"done_id",
			),
		).toBe(false);
	});
});

describe("buildWorkflowLabelUpdate", () => {
	it("adds the next workflow label and removes stale workflow labels", () => {
		expect(
			buildWorkflowLabelUpdate(
				["lbl_reviewing", "lbl_backend"],
				["lbl_pr", "lbl_reviewing", "lbl_testing"],
				"lbl_testing",
			),
		).toEqual({
			addedLabelIds: ["lbl_testing"],
			removedLabelIds: ["lbl_reviewing"],
		});
	});

	it("removes all workflow labels when no next label is provided", () => {
		expect(
			buildWorkflowLabelUpdate(
				["lbl_testing", "lbl_backend"],
				["lbl_pr", "lbl_reviewing", "lbl_testing"],
			),
		).toEqual({
			addedLabelIds: [],
			removedLabelIds: ["lbl_testing"],
		});
	});
});

describe("buildTodoIssueFromPlanInput", () => {
	it("uses parent project and creator assignee for split sub-issues", () => {
		const input = buildTodoIssueFromPlanInput({
			task: {
				title: "Split task",
				description: "Implement sub-scope",
				priority: 2,
			},
			parentIssue: {
				id: "lin_parent",
				key: "ROY-35",
				title: "Parent task",
				url: "https://linear.app/roy/issue/ROY-35/example",
				projectId: "proj_parent",
				creatorId: "user_creator",
			},
			assignedStateId: "state_todo_123",
			teamId: "team_123",
			projectId: "proj_config",
		});

		expect(input).toEqual({
			title: "[ROY-35] Split task",
			description: [
				"Task summary:",
				"Implement sub-scope",
				"",
				"Parent issue:",
				"ROY-35: Parent task",
				"https://linear.app/roy/issue/ROY-35/example",
				"",
				"Planner metadata:",
				"Priority: 2",
				"",
				"Source:",
				"Generated by ADHD.ai planning decomposition.",
			].join("\n"),
			stateId: "state_todo_123",
			teamId: "team_123",
			parentId: "lin_parent",
			projectId: "proj_parent",
			assigneeId: "user_creator",
			priority: 2,
		});
	});

	it("falls back to configured project when parent has no project", () => {
		const input = buildTodoIssueFromPlanInput({
			task: {
				title: "Split task",
			},
			parentIssue: {
				id: "lin_parent",
				key: "ROY-35",
				title: "Parent task",
				url: "https://linear.app/roy/issue/ROY-35/example",
				creatorId: "user_creator",
			},
			assignedStateId: "state_todo_123",
			teamId: "team_123",
			projectId: "proj_config",
		});

		expect(input.parentId).toBe("lin_parent");
		expect(input.projectId).toBe("proj_config");
		expect(input.assigneeId).toBe("user_creator");
	});

	it("omits assignee when parent creator is missing", () => {
		const input = buildTodoIssueFromPlanInput({
			task: {
				title: "Split task",
			},
			parentIssue: {
				id: "lin_parent",
				key: "ROY-35",
				title: "Parent task",
				url: "https://linear.app/roy/issue/ROY-35/example",
				projectId: "proj_parent",
			},
			assignedStateId: "state_todo_123",
			teamId: "team_123",
			projectId: "proj_config",
		});

		expect(input.parentId).toBe("lin_parent");
		expect(input.projectId).toBe("proj_parent");
		expect("assigneeId" in input).toBe(false);
	});
});

describe("Linear rate limit handling", () => {
	it("detects Linear rate limit errors by status and message", () => {
		expect(isLinearRateLimitError({ status: 429 })).toBe(true);
		expect(
			isLinearRateLimitError(
				new Error(
					"Rate limit exceeded. Only 2500 requests are allowed per 1 hour",
				),
			),
		).toBe(true);
		expect(isLinearRateLimitError(new Error("not found"))).toBe(false);
	});

	it("uses retry-after header when present", () => {
		const error = {
			response: {
				headers: {
					"retry-after": "3",
				},
			},
		};

		expect(resolveLinearRateLimitDelayMs(error)).toBe(3000);
	});

	it("uses the reported rate limit window when retry-after is missing", () => {
		expect(
			resolveLinearRateLimitDelayMs(
				new Error(
					"Rate limit exceeded. Only 2500 requests are allowed per 1 hour",
				),
			),
		).toBe(3_600_000);
	});

	it("falls back to a bounded delay for Linear rate limits", () => {
		expect(resolveLinearRateLimitDelayMs({ status: 429 })).toBe(60_000);
		expect(resolveLinearRateLimitDelayMs(new Error("boom"))).toBeUndefined();
	});
});

describe("buildSplitTaskIssueTitle", () => {
	it("prefixes title with parent key", () => {
		expect(buildSplitTaskIssueTitle("ROY-35", "Implement API")).toBe(
			"[ROY-35] Implement API",
		);
	});

	it("avoids adding duplicate parent key prefix", () => {
		expect(buildSplitTaskIssueTitle("ROY-35", "[ROY-35] Implement API")).toBe(
			"[ROY-35] Implement API",
		);
		expect(buildSplitTaskIssueTitle("ROY-35", "ROY-35: Implement API")).toBe(
			"ROY-35: Implement API",
		);
	});
});

describe("buildSplitTaskIssueDescription", () => {
	it("includes summary, parent context, and planner metadata", () => {
		const description = buildSplitTaskIssueDescription({
			task: {
				title: "Task A",
				description: "Ship onboarding updates",
				labels: ["frontend", " ux ", ""],
				priority: 1,
			},
			parentIssue: {
				id: "lin_parent",
				key: "ROY-35",
				title: "Onboarding refresh",
				url: "https://linear.app/roy/issue/ROY-35/example",
			},
		});

		expect(description).toContain("Task summary:\nShip onboarding updates");
		expect(description).toContain("Parent issue:\nROY-35: Onboarding refresh");
		expect(description).toContain("Labels: frontend, ux");
		expect(description).toContain("Priority: 1");
		expect(description).toContain(
			"Generated by ADHD.ai planning decomposition.",
		);
	});

	it("falls back when planner description is missing", () => {
		const description = buildSplitTaskIssueDescription({
			task: {
				title: "Task B",
			},
			parentIssue: {
				id: "lin_parent",
				key: "ROY-35",
				title: "Onboarding refresh",
				url: "https://linear.app/roy/issue/ROY-35/example",
			},
		});

		expect(description).toContain("No task summary provided by planner.");
		expect(description).not.toContain("Planner metadata:");
	});
});

describe("resolveSplitTaskTeamId", () => {
	it("prefers configured team id", () => {
		expect(resolveSplitTaskTeamId(" team_config ", " team_parent ")).toBe(
			"team_config",
		);
	});

	it("falls back to parent issue team id", () => {
		expect(resolveSplitTaskTeamId(undefined, " team_parent ")).toBe(
			"team_parent",
		);
	});

	it("throws when no team id can be resolved", () => {
		expect(() => resolveSplitTaskTeamId("", undefined)).toThrow(
			"neither linear.teamId nor the parent issue team id is available",
		);
	});
});
