import { describe, expect, it } from "bun:test";
import type { AgentRow, BoardTaskRow, SkillRow } from "devos-db";
import { createProjectService } from "../src/projects";
import type { ProjectRepository } from "../src/projects";
import { createEntityCrudService } from "../src/routes/entity-crud-service";
import type { EntityCrudRepository } from "../src/routes/types/entity-crud-service.types";
import { createTaskService, parseTaskIntakeOutput } from "../src/tasks";
import type { BoardTaskRepositoryRecord, TaskRepository } from "../src/tasks";

describe("server services", () => {
	it("keeps project business rules out of controllers", async () => {
		const createdProjects: unknown[] = [];
		const service = createProjectService({
			listProjects: async () => [],
			getProject: async () => null,
			boardExists: async (id) => id === "board-1",
			createProject: async (input) => {
				createdProjects.push(input);
				return {
					...input,
					description: input.description ?? null,
					emoji: input.emoji ?? null,
					externalProjectId: input.externalProjectId ?? null,
					repoOwner: input.repoOwner ?? null,
					repoName: input.repoName ?? null,
					baseBranch: input.baseBranch ?? null,
					localFolder: input.localFolder ?? null,
					lead: input.lead ?? null,
					category: input.category ?? null,
					priority: input.priority ?? null,
				};
			},
			updateProject: async () => null,
			deleteProject: async () => null,
		} satisfies ProjectRepository);

		const fkResult = await service.createProject({
			boardId: "missing",
			name: "Project",
			ownerId: "owner-1",
		});
		expect(fkResult.status).toBe("foreign_key_error");

		const created = await service.createProject({
			boardId: "board-1",
			name: "Project",
			ownerId: "owner-1",
		});
		expect(created.status).toBe("ok");
		expect(createdProjects).toHaveLength(1);
		expect(createdProjects[0]).toMatchObject({
			boardId: "board-1",
			description: null,
			emoji: null,
			externalProjectId: null,
			repoOwner: null,
			repoName: null,
			baseBranch: null,
			localFolder: null,
			lead: null,
			category: null,
			priority: null,
			name: "Project",
			ownerId: "owner-1",
		});
	});

	it("creates task defaults and rejects empty task updates", async () => {
		const createdTasks: unknown[] = [];
		const keyScopes: unknown[] = [];
		const storedTasks = new Map<string, BoardTaskRepositoryRecord>();
		const service = createTaskService({
			listTasks: async () => [],
			getTask: async (id) => storedTasks.get(id) ?? null,
			getTaskActivity: async (id) => {
				const task = storedTasks.get(id);
				return task
					? {
							task,
							comments: [],
							executionLogs: [],
							executionSteps: [],
						}
					: null;
			},
			projectExists: async (id) => id === "project-1",
			nextTaskKey: async (scope) => {
				keyScopes.push(scope);
				return "OWN-1";
			},
			createTask: async (input, assigneeId) => {
				const created = {
					...input,
					assigneeId: assigneeId ?? null,
					projectId: input.projectId ?? null,
					dueDate: input.dueDate ?? null,
					linkedPr: input.linkedPr ?? null,
					linearIssueId: null,
					linearIdentifier: null,
					linearUrl: null,
				};
				createdTasks.push(created);
				storedTasks.set(created.id, created);
				return created;
			},
			updateTask: async () => null,
			deleteTask: async () => null,
			addTaskComment: async () => {},
		} satisfies TaskRepository);

		const created = await service.createTask({
			title: "Task",
			content: "Body",
			priority: 1,
			status: "open",
			creatorId: "owner-1",
		});
		expect(created.status).toBe("ok");
		expect(createdTasks[0]).toMatchObject({
			taskKey: "OWN-1",
			projectId: null,
		});
		expect(created.status === "ok" ? created.value : {}).not.toHaveProperty(
			"linearIdentifier",
		);
		expect(keyScopes).toEqual([{ projectId: null, creatorId: "owner-1" }]);

		const emptyUpdate = await service.updateTask("task-1", {});
		expect(emptyUpdate.status).toBe("invalid_payload");

		const chatTask = buildServiceTask({ id: "chat-task", projectId: null });
		const persisted = await service.ensureChatCreatedTask(
			{ projectId: "project-1" },
			chatTask,
		);
		expect(persisted.status).toBe("ok");
		if (persisted.status === "ok") {
			expect(persisted.value.projectId).toBe("project-1");
		}

		const duplicate = await service.ensureChatCreatedTask(
			{ projectId: "project-1" },
			chatTask,
		);
		expect(duplicate.status).toBe("ok");
		expect(
			createdTasks.filter((task) => task === storedTasks.get("chat-task")),
		).toHaveLength(1);

		const fkFailure = await service.ensureChatCreatedTask(
			{ projectId: "missing-project" },
			buildServiceTask({ id: "missing-project-task", projectId: null }),
		);
		expect(fkFailure.status).toBe("foreign_key_error");
	});

	it("maps agent and skill CRUD through the entity service", async () => {
		const storedAgents: AgentRow[] = [];
		const skill: SkillRow = {
			id: "skill-1",
			name: "Skill",
			description: "Desc",
			source: "folder",
			updatedAt: "2026-05-13T00:00:00.000Z",
		};
		const service = createEntityCrudService({
			listAgents: async () => storedAgents,
			getAgent: async () => null,
			createAgent: async (input) => {
				storedAgents.push(input as AgentRow);
				return input as AgentRow;
			},
			updateAgent: async () => null,
			deleteAgent: async () => null,
			listSkills: async () => [skill],
			getSkill: async () => skill,
			createSkill: async () => skill,
			updateSkill: async () => null,
			deleteSkill: async () => null,
		} satisfies EntityCrudRepository);

		const created = await service.createAgent({
			id: "agent-1",
			name: "Agent",
			backend: "codex",
			model: "gpt-5",
			createdAt: "2026-05-13T00:00:00.000Z",
		});
		expect(created.status).toBe("ok");
		if (created.status === "ok") {
			expect(created.value).toMatchObject({
				id: "agent-1",
				concurrency: 1,
				owner: "unassigned",
				skills: [],
			});
		}
		expect((await service.listSkills()).status).toBe("ok");
		expect(
			(await service.updateAgent("missing", { model: "gpt-5.1" })).status,
		).toBe("not_found");
	});

	it("normalizes task-chat legacy output and rejects stale Linear errors", () => {
		const parsed = parseTaskIntakeOutput(
			`${JSON.stringify({
				status: "created",
				task: {
					id: "task-1",
					taskKey: "TASK-000001",
					projectId: null,
					title: "Task",
					description: "Legacy body",
					priority: 1,
					status: "planning",
					dueDate: null,
					creatorId: "owner-1",
					linkedPr: null,
					linearIssueId: null,
					linearIdentifier: null,
					linearUrl: null,
					createdAt: "2026-05-13T00:00:00.000Z",
					updatedAt: "2026-05-13T00:00:00.000Z",
				},
			})}\n`,
		);
		expect(parsed.status).toBe("created");
		if (parsed.status === "created") {
			expect(parsed.task.content).toBe("Legacy body");
		}
		expect(() =>
			parseTaskIntakeOutput(
				'{"status":"linear_error","error":"legacy parser failed"}\n',
			),
		).toThrow("legacy Linear error output");
	});
});

function buildServiceTask(overrides: Partial<BoardTaskRow> = {}): BoardTaskRow {
	return {
		id: "task-1",
		taskKey: "TASK-000001",
		projectId: null,
		title: "Task",
		content: "Body",
		priority: 1,
		status: "planning",
		dueDate: null,
		creatorId: "owner-1",
		linkedPr: null,
		linearIssueId: null,
		linearIdentifier: null,
		linearUrl: null,
		createdAt: "2026-05-13T00:00:00.000Z",
		updatedAt: "2026-05-13T00:00:00.000Z",
		...overrides,
	};
}
