import { isForeignKeyError } from "../http/http-utils";
import type { UpdateTaskPayload } from "../http/project-task-api.types";
import { composeTaskActivity } from "./task-activity-compose";
import type {
	BoardTaskApiRecord,
	TaskRepository,
	TaskService,
} from "./task-service.types";

const UPDATE_ACTIVITY_FIELDS: Array<keyof UpdateTaskPayload> = [
	"taskKey",
	"projectId",
	"title",
	"content",
	"priority",
	"status",
	"creatorId",
	"assigneeId",
	"dueDate",
	"linkedPr",
	"linearIssueId",
	"linearIdentifier",
	"linearUrl",
];
const LEGACY_PR_CREATED_STATUS = "pr_created";

export function createTaskService(repository: TaskRepository): TaskService {
	return {
		async listTasks() {
			return { status: "ok", value: await repository.listTasks() };
		},
		async getTask(id) {
			const task = await repository.getTask(id);
			return task ? { status: "ok", value: task } : { status: "not_found" };
		},
		async getTaskActivity(id) {
			const rows = await repository.getTaskActivity(id);
			return rows
				? { status: "ok", value: composeTaskActivity(rows) }
				: { status: "not_found" };
		},
		async createTask(input) {
			if (
				input.projectId &&
				!(await repository.projectExists(input.projectId))
			) {
				return { status: "foreign_key_error" };
			}
			const now = new Date().toISOString();
			try {
				const created = await repository.createTask(
					{
						id: crypto.randomUUID(),
						taskKey:
							input.taskKey ??
							(await repository.nextTaskKey({
								projectId: input.projectId ?? null,
								creatorId: input.creatorId,
							})),
						projectId: input.projectId ?? null,
						title: input.title,
						content: input.content,
						priority: input.priority,
						status: normalizeTaskStatus(input.status),
						dueDate: input.dueDate ?? null,
						creatorId: input.creatorId,
						linkedPr: input.linkedPr ?? null,
						linearIssueId: input.linearIssueId ?? null,
						linearIdentifier: input.linearIdentifier ?? null,
						linearUrl: input.linearUrl ?? null,
						createdAt: now,
						updatedAt: now,
					},
					input.assigneeId ?? null,
				);
				return { status: "ok", value: created };
			} catch (error) {
				return mapMutationError(error);
			}
		},
		async ensureChatCreatedTask(input, task) {
			const existing = await repository.getTask(task.id);
			if (existing) {
				return { status: "ok", value: existing };
			}
			const projectId = input.projectId ?? task.projectId;
			if (projectId && !(await repository.projectExists(projectId))) {
				return { status: "foreign_key_error" };
			}
			try {
				const created = await repository.createTask({
					...task,
					projectId: projectId ?? null,
					status: normalizeTaskStatus(task.status),
				});
				return { status: "ok", value: created };
			} catch (error) {
				return mapMutationError(error);
			}
		},
		async updateTask(id, input) {
			if (Object.keys(input).length === 0) {
				return { status: "invalid_payload" };
			}
			if (
				input.projectId &&
				!(await repository.projectExists(input.projectId))
			) {
				return { status: "foreign_key_error" };
			}
			try {
				const existing = await repository.getTask(id);
				if (!existing) {
					return { status: "not_found" };
				}
				const { assigneeId, ...taskInput } = input;
				const normalizedTaskInput = {
					...taskInput,
					...(taskInput.status
						? { status: normalizeTaskStatus(taskInput.status) }
						: {}),
				};
				const updated = await repository.updateTask(
					id,
					{
						...normalizedTaskInput,
						updatedAt: new Date().toISOString(),
					},
					assigneeId,
				);
				if (updated) {
					const body = describeTaskUpdate(existing, updated, input);
					if (body) {
						await repository.addTaskComment({
							id: crypto.randomUUID(),
							taskId: id,
							authorId: "system",
							authorType: "system",
							comment: body,
							createdAt: updated.updatedAt,
						});
					}
				}
				return updated
					? { status: "ok", value: updated }
					: { status: "not_found" };
			} catch (error) {
				return mapMutationError(error);
			}
		},
		async deleteTask(id) {
			try {
				const deleted = await repository.deleteTask(id);
				return deleted
					? { status: "ok", value: deleted }
					: { status: "not_found" };
			} catch (error) {
				return mapMutationError(error);
			}
		},
	};
}

function describeTaskUpdate(
	existing: BoardTaskApiRecord,
	updated: BoardTaskApiRecord,
	input: UpdateTaskPayload,
): string | null {
	const lines = UPDATE_ACTIVITY_FIELDS.flatMap((field) => {
		if (!(field in input) || existing[field] === updated[field]) {
			return [];
		}
		return [
			`changed ${fieldLabel(field)} from ${formatValue(
				existing[field],
			)} to ${formatValue(updated[field])}`,
		];
	});
	return lines.length > 0 ? lines.join("\n") : null;
}

function fieldLabel(field: keyof UpdateTaskPayload): string {
	return field === "content"
		? "description"
		: field.replace(/[A-Z]/g, (match) => ` ${match.toLowerCase()}`);
}

function formatValue(value: string | number | null | undefined): string {
	if (value === null || value === undefined || value === "") {
		return "`empty`";
	}
	const text = String(value).replace(/\s+/g, " ").trim();
	const truncated = text.length > 120 ? `${text.slice(0, 117)}...` : text;
	return `\`${truncated}\``;
}

function normalizeTaskStatus(status: string): string {
	return status === LEGACY_PR_CREATED_STATUS ? "reviewing" : status;
}

function mapMutationError(error: unknown) {
	return isForeignKeyError(error)
		? { status: "foreign_key_error" as const }
		: { status: "invalid_payload" as const };
}
