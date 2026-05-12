import { describe, expect, it } from "bun:test";
import type { LinearIssue, ResolvedProjectConfig } from "../src/features/types";
import {
	LinearClient,
	buildBacklogTaskIssueInput,
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
} from "../src/integrations/linear";

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

describe("buildBacklogTaskIssueInput", () => {
	it("builds Linear create payload for configured backlog tasks", () => {
		expect(
			buildBacklogTaskIssueInput({
				title: "Create task intake CLI",
				description: "Clarify requirements before creating Linear issues.",
				backlogStateId: "state_backlog",
				teamId: "team_123",
				projectId: "proj_123",
			}),
		).toEqual({
			title: "Create task intake CLI",
			description: "Clarify requirements before creating Linear issues.",
			stateId: "state_backlog",
			teamId: "team_123",
			projectId: "proj_123",
		});
	});
});

describe("LinearClient.createBacklogTask", () => {
	it("resolves backlog status and creates the issue in configured team/project", async () => {
		const capturedInputs: Array<Record<string, unknown>> = [];
		const client = new LinearClient(createLinearProject());
		disableLinearRequestThrottle(client);
		replaceLinearSdkClient(client, {
			workflowStates: async () => ({
				nodes: [
					{ id: "state_backlog", name: "Backlog", teamId: "team_123" },
					{ id: "state_todo", name: "Todo", teamId: "team_123" },
					{ id: "state_progress", name: "In Progress", teamId: "team_123" },
					{ id: "state_review", name: "In Review", teamId: "team_123" },
					{ id: "state_canceled", name: "Canceled", teamId: "team_123" },
					{ id: "state_done", name: "Done", teamId: "team_123" },
				],
			}),
			createIssue: async (input: Record<string, unknown>) => {
				capturedInputs.push(input);
				return {
					success: true,
					issue: Promise.resolve({
						id: "lin_created",
						identifier: "ROY-100",
						title: String(input.title),
						url: "https://linear.example/ROY-100",
					}),
				};
			},
		});

		const created = await client.createBacklogTask({
			title: "Create task intake CLI",
			description: "Clarify then create backlog tasks.",
		});

		expect(capturedInputs).toEqual([
			{
				title: "Create task intake CLI",
				description: "Clarify then create backlog tasks.",
				stateId: "state_backlog",
				teamId: "team_123",
				projectId: "proj_123",
			},
		]);
		expect(created.identifier).toBe("ROY-100");
	});

	it("resolves missing team id from a single configured project team", async () => {
		const capturedInputs: Array<Record<string, unknown>> = [];
		const client = new LinearClient({
			...createLinearProject(),
			linear: { ...createLinearProject().linear, teamId: undefined },
		});
		disableLinearRequestThrottle(client);
		replaceLinearSdkClient(
			client,
			createBacklogFakeClient({
				capturedInputs,
				projectTeams: [{ id: "team_project" }],
				workflowStates: [
					{ id: "state_other_backlog", name: "Backlog", teamId: "team_other" },
					{
						id: "state_project_backlog",
						name: "Backlog",
						teamId: "team_project",
					},
				],
			}),
		);

		await client.createBacklogTask({
			title: "Create task intake CLI",
			description: "Clarify then create backlog tasks.",
		});

		expect(capturedInputs[0]).toMatchObject({
			stateId: "state_project_backlog",
			teamId: "team_project",
			projectId: "proj_123",
		});
	});

	it("resolves missing team id from a unique backlog state team", async () => {
		const capturedInputs: Array<Record<string, unknown>> = [];
		const client = new LinearClient({
			...createLinearProject(),
			linear: {
				...createLinearProject().linear,
				projectId: undefined,
				teamId: undefined,
			},
		});
		disableLinearRequestThrottle(client);
		replaceLinearSdkClient(
			client,
			createBacklogFakeClient({
				capturedInputs,
				workflowStates: [
					{
						id: "state_backlog_unique",
						name: "Backlog",
						teamId: "team_unique",
					},
				],
			}),
		);

		await client.createBacklogTask({
			title: "Create task intake CLI",
			description: "Clarify then create backlog tasks.",
		});

		expect(capturedInputs[0]).toMatchObject({
			stateId: "state_backlog_unique",
			teamId: "team_unique",
		});
		expect(capturedInputs[0]).not.toHaveProperty("projectId");
	});

	it("fails when configured project is attached to multiple teams", async () => {
		const client = new LinearClient({
			...createLinearProject(),
			linear: { ...createLinearProject().linear, teamId: undefined },
		});
		disableLinearRequestThrottle(client);
		replaceLinearSdkClient(
			client,
			createBacklogFakeClient({
				projectTeams: [{ id: "team_a" }, { id: "team_b" }],
				workflowStates: [
					{ id: "state_backlog_a", name: "Backlog", teamId: "team_a" },
				],
			}),
		);

		await expect(
			client.createBacklogTask({ title: "Title", description: "Description" }),
		).rejects.toThrow("attached to multiple teams: team_a, team_b");
	});

	it("fails when backlog status matches multiple teams", async () => {
		const client = new LinearClient({
			...createLinearProject(),
			linear: {
				...createLinearProject().linear,
				projectId: undefined,
				teamId: undefined,
			},
		});
		disableLinearRequestThrottle(client);
		replaceLinearSdkClient(
			client,
			createBacklogFakeClient({
				workflowStates: [
					{ id: "state_backlog_a", name: "Backlog", teamId: "team_a" },
					{ id: "state_backlog_b", name: "Backlog", teamId: "team_b" },
				],
			}),
		);

		await expect(
			client.createBacklogTask({ title: "Title", description: "Description" }),
		).rejects.toThrow("exists for multiple teams: team_a, team_b");
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

function disableLinearRequestThrottle(client: LinearClient): void {
	(
		client as unknown as {
			linearRequest: <T>(operation: () => T | PromiseLike<T>) => Promise<T>;
		}
	).linearRequest = async (operation) => operation();
}

function replaceLinearSdkClient(
	client: LinearClient,
	sdkClient: unknown,
): void {
	(client as unknown as { client: unknown }).client = sdkClient;
}

function createBacklogFakeClient(input: {
	capturedInputs?: Array<Record<string, unknown>>;
	projectTeams?: Array<{ id: string }>;
	workflowStates: Array<{ id: string; name: string; teamId: string }>;
}) {
	return {
		project: async () =>
			input.projectTeams
				? {
						teams: async () => ({ nodes: input.projectTeams }),
					}
				: undefined,
		workflowStates: async () => ({
			nodes: input.workflowStates,
		}),
		createIssue: async (createInput: Record<string, unknown>) => {
			input.capturedInputs?.push(createInput);
			return {
				success: true,
				issue: Promise.resolve({
					id: "lin_created",
					identifier: "ROY-100",
					title: String(createInput.title),
					url: "https://linear.example/ROY-100",
				}),
			};
		},
	};
}

function createLinearProject(): ResolvedProjectConfig {
	return {
		id: "default",
		name: "Default",
		workspacePath: "/tmp/work",
		executionPath: "/tmp/work",
		repo: { owner: "acme", name: "repo", baseBranch: "main" },
		linear: {
			apiKey: "key",
			apiUrl: "https://linear.example/graphql",
			projectId: "proj_123",
			teamId: "team_123",
			pollLimit: 10,
			statusMap: {
				backlog: "Backlog",
				assigned: "Todo",
				planning: "In Progress",
				implementing: "In Progress",
				pr_created: "In Review",
				reviewing: "In Review",
				testing: "In Review",
				blocked: "Canceled",
				done: "Done",
			},
			labelMap: {},
			autoCreateLabels: false,
		},
		github: { useGhCli: false, defaultBugLabel: "bug" },
		codex: { binary: "codex", streamLogs: false },
		skills: {
			root: "skills",
			plan: "skills/piv-plan/SKILL.md",
			implement: "skills/piv-implement/SKILL.md",
			reviewTest: "skills/piv-review-test/SKILL.md",
			githubComment: "skills/piv-github-comment/SKILL.md",
			createTask: "skills/adhd-explore/SKILL.md",
		},
		workflow: { issueConcurrency: 1 },
		dryRun: false,
	};
}
