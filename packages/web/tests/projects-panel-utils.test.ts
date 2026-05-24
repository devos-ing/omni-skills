import { describe, expect, it } from "bun:test";
import {
	EMPTY_PROJECT_FORM_STATE,
	buildProjectCreateRequest,
	buildProjectDisplayRows,
	filterProjects,
	formatProjectCreatedAt,
} from "../src/components/projects/projects-panel-utils";
import type { WorkspaceProjectRecord } from "../src/lib/api";

const defaults = {
	boardId: "board-1",
	ownerId: "owner-1",
};

describe("projects panel create request builder", () => {
	it("maps a GitHub HTTPS repository URL to the API request", () => {
		const request = buildProjectCreateRequest(
			{
				name: "  Web Project  ",
				externalProjectId: "  external-1  ",
				description: "  Created from UI  ",
				repositoryUrl: "  https://github.com/octo/demo.git  ",
				localFolder: "  /tmp/demo  ",
				lead: "  Roy  ",
				category: "  platform  ",
				priority: " 2 ",
			},
			defaults,
		);

		expect(request).toEqual({
			boardId: "board-1",
			ownerId: "owner-1",
			name: "Web Project",
			externalProjectId: "external-1",
			description: "Created from UI",
			repoOwner: "octo",
			repoName: "demo",
			baseBranch: "main",
			localFolder: "/tmp/demo",
			lead: "Roy",
			category: "platform",
			priority: 2,
		});
	});

	it("parses supported GitHub repository URL forms", () => {
		const cases = [
			"https://github.com/octo/demo",
			"https://github.com/octo/demo.git",
			"git@github.com:octo/demo.git",
			"ssh://git@github.com/octo/demo.git",
		];

		for (const repositoryUrl of cases) {
			const request = buildProjectCreateRequest(
				{
					...EMPTY_PROJECT_FORM_STATE,
					name: "Web Project",
					repositoryUrl,
				},
				defaults,
			);

			expect(request.repoOwner).toBe("octo");
			expect(request.repoName).toBe("demo");
			expect(request.baseBranch).toBe("main");
		}
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

	it("requires a valid GitHub repository URL when one is provided", () => {
		expect(() =>
			buildProjectCreateRequest(
				{
					...EMPTY_PROJECT_FORM_STATE,
					name: "Web Project",
					repositoryUrl: "https://gitlab.com/octo/demo",
				},
				defaults,
			),
		).toThrow("Repository URL must be a GitHub HTTPS or SSH clone URL");
	});

	it("requires a project name and integer priority", () => {
		expect(() =>
			buildProjectCreateRequest(
				{ ...EMPTY_PROJECT_FORM_STATE, name: " " },
				defaults,
			),
		).toThrow("Project name is required");
		expect(() =>
			buildProjectCreateRequest(
				{
					...EMPTY_PROJECT_FORM_STATE,
					name: "Web Project",
					priority: "1.5",
				},
				defaults,
			),
		).toThrow("Priority must be an integer");
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
