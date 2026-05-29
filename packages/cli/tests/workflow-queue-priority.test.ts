import { describe, expect, it } from "bun:test";
import type { RunState } from "../src/features/types";
import type { WorkflowIssue } from "../src/features/workflow/types/workflow.types";
import { buildReviewOnlyIssueQueue } from "../src/features/workflow/workflow-queue";

describe("workflow queue priority ordering", () => {
	it("sorts review-only candidates before workflow execution", () => {
		const runStates: RunState[] = [
			reviewState("ROY-1", "https://github.com/acme/repo/pull/1"),
			reviewState("ROY-3", "https://github.com/acme/repo/pull/3"),
		];
		const localIssues = [
			issue("ROY-1", 2, "High"),
			issue("ROY-3", 3, "Medium"),
		];
		const taskIssues = [issue("ROY-2", 1, "Urgent"), issue("ROY-4", 4, "Low")];

		const result = buildReviewOnlyIssueQueue({
			runStates,
			localIssues,
			taskIssues,
			discoveredPullRequestsByIssueKey: new Map([
				["ROY-2", pullRequest("https://github.com/acme/repo/pull/2")],
				["ROY-4", pullRequest("https://github.com/acme/repo/pull/4")],
			]),
		});

		expect(
			result.issueQueue.map((queuedIssue) => queuedIssue.identifier),
		).toEqual(["ROY-2", "ROY-1", "ROY-3", "ROY-4"]);
	});
});

function reviewState(issueKey: string, pullRequestUrl: string): RunState {
	const timestamp = "2026-05-29T00:00:00.000Z";
	return {
		projectId: "default",
		projectName: "Default",
		workspacePath: "/tmp/work",
		repository: {
			owner: "acme",
			name: "repo",
			baseBranch: "main",
		},
		issue: {
			id: `lin_${issueKey}`,
			key: issueKey,
			title: issueKey,
			url: `https://linear.app/acme/issue/${issueKey}/sample`,
		},
		stage: "in_review",
		bugs: [],
		startedAt: timestamp,
		updatedAt: timestamp,
		pullRequest: pullRequest(pullRequestUrl),
	};
}

function issue(
	identifier: string,
	priorityValue: number,
	priorityName: string,
): WorkflowIssue {
	return {
		id: identifier,
		identifier,
		title: identifier,
		url: `https://linear.app/acme/issue/${identifier}/sample`,
		priority: {
			value: priorityValue,
			name: priorityName,
		},
		labels: [],
		state: {
			id: "state_assigned",
			name: "Todo",
		},
	};
}

function pullRequest(url: string): NonNullable<RunState["pullRequest"]> {
	return {
		branch: "codex/review",
		title: "Review",
		url,
	};
}
