import { describe, expect, it } from "bun:test";
import * as projectUtils from "../src/components/projects/projects-panel-utils";
import {
	DEFAULT_PROJECT_EMOJI,
	EMPTY_PROJECT_FORM_STATE,
	buildProjectCreateRequest,
	buildProjectDisplayRows,
	filterProjects,
	formatProjectCreatedAt,
} from "../src/components/projects/projects-panel-utils";
import type { ProjectFormState } from "../src/components/projects/types/projects-panel.types";
import type {
	GitHubRepositoryRecord,
	ProjectUpdateRequest,
	WorkspaceProjectRecord,
} from "../src/lib/api";

const defaults = {
	boardId: "board-1",
	ownerId: "owner-1",
};

describe("projects panel create request builder", () => {
	it("maps a manual owner/repo repository to the API request", () => {
		const request = buildProjectCreateRequest(
			{
				...EMPTY_PROJECT_FORM_STATE,
				name: "  Web Project  ",
				emoji: "🧭",
				description: "  Created from UI  ",
				repositoryMode: "manual",
				manualRepository: "  octo/demo  ",
			},
			defaults,
		);

		expect(request).toEqual({
			boardId: "board-1",
			ownerId: "owner-1",
			name: "Web Project",
			emoji: "🧭",
			externalProjectId: null,
			description: "Created from UI",
			repoOwner: "octo",
			repoName: "demo",
			baseBranch: "main",
			localFolder: null,
			lead: null,
			category: null,
			priority: null,
		});
	});

	it("maps a discovered GitHub repository option to the API request", () => {
		const request = buildProjectCreateRequest(
			{
				...EMPTY_PROJECT_FORM_STATE,
				name: "Web Project",
				repositoryMode: "select",
				selectedRepository: "octo/core",
			},
			defaults,
			[
				repositoryOption({
					id: "octo/core",
					name: "core",
					nameWithOwner: "octo/core",
					defaultBranch: "trunk",
				}),
			],
		);

		expect(request.repoOwner).toBe("octo");
		expect(request.repoName).toBe("core");
		expect(request.baseBranch).toBe("trunk");
	});

	it("normalizes optional blank fields to null", () => {
		const request = buildProjectCreateRequest(
			{
				...EMPTY_PROJECT_FORM_STATE,
				name: "Web Project",
			},
			defaults,
		);

		expect(request).toEqual({
			boardId: "board-1",
			ownerId: "owner-1",
			name: "Web Project",
			emoji: DEFAULT_PROJECT_EMOJI,
			externalProjectId: null,
			description: null,
			repoOwner: null,
			repoName: null,
			baseBranch: null,
			localFolder: null,
			lead: null,
			category: null,
			priority: null,
		});
	});

	it("requires a valid owner/repo repository when one is provided", () => {
		expect(() =>
			buildProjectCreateRequest(
				{
					...EMPTY_PROJECT_FORM_STATE,
					name: "Web Project",
					repositoryMode: "manual",
					manualRepository: "https://github.com/octo/demo",
				},
				defaults,
			),
		).toThrow("Repository must be owner/repo");
	});

	it("requires a project name", () => {
		expect(() =>
			buildProjectCreateRequest(
				{ ...EMPTY_PROJECT_FORM_STATE, name: " " },
				defaults,
			),
		).toThrow("Project name is required");
	});
});

describe("projects panel edit request builder", () => {
	it("prefills editable project metadata from an existing project", () => {
		const buildProjectEditFormState = (
			projectUtils as {
				buildProjectEditFormState?: (
					project: WorkspaceProjectRecord,
				) => ProjectFormState;
			}
		).buildProjectEditFormState;

		expect(buildProjectEditFormState?.(buildProject())).toEqual({
			name: "Project",
			emoji: DEFAULT_PROJECT_EMOJI,
			description: "Project description",
			repositoryMode: "manual",
			selectedRepository: "",
			manualRepository: "devos/show-me-ur-agents",
			lead: "",
			priority: "2",
		});
	});

	it("maps editable metadata and selected repository to an update request", () => {
		const buildProjectUpdateRequest = (
			projectUtils as {
				buildProjectUpdateRequest?: (
					form: ProjectFormState,
					repositories: GitHubRepositoryRecord[],
				) => ProjectUpdateRequest;
			}
		).buildProjectUpdateRequest;

		expect(
			buildProjectUpdateRequest?.(
				{
					...EMPTY_PROJECT_FORM_STATE,
					name: "  Web Project Updated  ",
					emoji: "🚀",
					description: "  Edited from UI  ",
					repositoryMode: "select",
					selectedRepository: "octo/core",
					lead: "  Roy  ",
					priority: "3",
				},
				[
					repositoryOption({
						id: "octo/core",
						name: "core",
						nameWithOwner: "octo/core",
						defaultBranch: "trunk",
					}),
				],
			),
		).toEqual({
			name: "Web Project Updated",
			emoji: "🚀",
			description: "Edited from UI",
			repoOwner: "octo",
			repoName: "core",
			baseBranch: "trunk",
			lead: "Roy",
			priority: 3,
		});
	});

	it("clears optional edit fields when left blank", () => {
		const buildProjectUpdateRequest = (
			projectUtils as {
				buildProjectUpdateRequest?: (
					form: ProjectFormState,
					repositories?: GitHubRepositoryRecord[],
				) => ProjectUpdateRequest;
			}
		).buildProjectUpdateRequest;

		expect(
			buildProjectUpdateRequest?.({
				...EMPTY_PROJECT_FORM_STATE,
				name: "Web Project",
				emoji: " ",
				description: " ",
				repositoryMode: "manual",
				manualRepository: " ",
				lead: " ",
				priority: " ",
			}),
		).toMatchObject({
			name: "Web Project",
			emoji: DEFAULT_PROJECT_EMOJI,
			description: null,
			repoOwner: null,
			repoName: null,
			baseBranch: null,
			lead: null,
			priority: null,
		});
	});

	it("requires edit priority to be a whole number when provided", () => {
		const buildProjectUpdateRequest = (
			projectUtils as {
				buildProjectUpdateRequest?: (
					form: ProjectFormState,
				) => ProjectUpdateRequest;
			}
		).buildProjectUpdateRequest;

		expect(() =>
			buildProjectUpdateRequest?.({
				...EMPTY_PROJECT_FORM_STATE,
				name: "Web Project",
				priority: "high",
			}),
		).toThrow("Priority must be a whole number");
	});
});

describe("projects panel table helpers", () => {
	it("filters projects across key display fields", () => {
		const projects = [
			buildProject({ id: "web", name: "Web", repoName: "operator-ui" }),
			buildProject({
				id: "worker",
				name: "Worker",
				category: "automation",
				lead: "Roy",
			}),
		];

		expect(filterProjects(projects, "operator")).toEqual([projects[0]]);
		expect(filterProjects(projects, "ROY")).toEqual([projects[1]]);
		expect(filterProjects(projects, " ")).toEqual(projects);
	});

	it("builds display rows with concise fallbacks", () => {
		const [row] = buildProjectDisplayRows(
			[
				buildProject({
					description: null,
					priority: null,
					repoOwner: null,
					repoName: null,
					createdAt: "2026-05-01T00:00:00.000Z",
				}),
			],
			new Date("2026-05-22T00:00:00.000Z"),
		);

		expect(row).toMatchObject({
			emojiLabel: DEFAULT_PROJECT_EMOJI,
			priorityLabel: "--",
			categoryLabel: "--",
			repositoryLabel: "--",
			leadLabel: "--",
			createdLabel: "3w ago",
			summaryLabel: "project-1",
		});
	});

	it("formats project created dates as compact relative labels", () => {
		const now = new Date("2026-05-25T12:00:00.000Z");

		expect(formatProjectCreatedAt("2026-05-25T11:59:40.000Z", now)).toBe(
			"Just now",
		);
		expect(formatProjectCreatedAt("2026-05-25T10:00:00.000Z", now)).toBe(
			"2h ago",
		);
		expect(formatProjectCreatedAt("2026-05-04T12:00:00.000Z", now)).toBe(
			"3w ago",
		);
		expect(formatProjectCreatedAt("not-a-date", now)).toBe("--");
	});
});

function buildProject(
	overrides: Partial<WorkspaceProjectRecord> = {},
): WorkspaceProjectRecord {
	return {
		id: "project-1",
		boardId: "board-1",
		workspaceId: "owner-1",
		externalProjectId: null,
		name: "Project",
		emoji: null,
		description: "Project description",
		repoOwner: "devos",
		repoName: "show-me-ur-agents",
		baseBranch: "main",
		localFolder: null,
		lead: null,
		category: null,
		priority: 2,
		createdAt: "2026-05-25T00:00:00.000Z",
		updatedAt: "2026-05-25T00:00:00.000Z",
		...overrides,
	};
}

function repositoryOption(
	overrides: Partial<GitHubRepositoryRecord> = {},
): GitHubRepositoryRecord {
	return {
		id: "octo/demo",
		owner: "octo",
		name: "demo",
		nameWithOwner: "octo/demo",
		defaultBranch: "main",
		isPrivate: false,
		...overrides,
	};
}
