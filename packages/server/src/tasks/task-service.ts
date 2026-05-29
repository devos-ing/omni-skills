import { isForeignKeyError } from "../http/http-utils";
import type { UpdateTaskPayload } from "../http/types/project-task-api.types";
import { composeTaskActivity } from "./task-activity-compose";
import type {
	BoardTaskApiRecord,
	BoardTaskRepositoryRecord,
	TaskRepository,
	TaskService,
} from "./types/task-service.types";

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
];
const LEGACY_PR_CREATED_STATUS = "pr_created";
const LEGACY_PLANNING_STATUS = "planning";
const LEGACY_PLAN_STATUS = "todo";
const LEGACY_IN_PROGRESS_STATUS = "implementing";
const LEGACY_REVIEW_STATUSES = ["reviewing", "testing"] as const;

export function createTaskService(repository: TaskRepository): TaskService {
	return {
		async listTasks() {
			const tasks = await repository.listTasks();
			return { status: "ok", value: tasks.map(toTaskApiRecord) };
		},
		async getTask(id) {
			const task = await repository.getTask(id);
			return task
				? { status: "ok", value: toTaskApiRecord(task) }
				: { status: "not_found" };
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
						createdAt: now,
						updatedAt: now,
					},
					input.assigneeId ?? null,
				);
				return { status: "ok", value: toTaskApiRecord(created) };
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
				return { status: "ok", value: toTaskApiRecord(created) };
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
					? { status: "ok", value: toTaskApiRecord(updated) }
					: { status: "not_found" };
			} catch (error) {
				return mapMutationError(error);
			}
		},
		async deleteTask(id) {
			try {
				const deleted = await repository.deleteTask(id);
				return deleted
					? { status: "ok", value: toTaskApiRecord(deleted) }
					: { status: "not_found" };
			} catch (error) {
				return mapMutationError(error);
			}
		},
	};
}

function describeTaskUpdate(
	existing: BoardTaskRepositoryRecord,
	updated: BoardTaskRepositoryRecord,
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

function toTaskApiRecord(task: BoardTaskRepositoryRecord): BoardTaskApiRecord {
	return {
		id: task.id,
		taskKey: task.taskKey,
		projectId: task.projectId,
		title: task.title,
		content: task.content,
		priority: task.priority,
		status: task.status,
		dueDate: task.dueDate,
		creatorId: task.creatorId,
		assigneeId: task.assigneeId,
		linkedPr: task.linkedPr,
		createdAt: task.createdAt,
		updatedAt: task.updatedAt,
	};
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
	if (status === LEGACY_PLANNING_STATUS) {
		return "plan";
	}
	if (status === LEGACY_PLAN_STATUS) {
		return "plan";
	}
	if (status === LEGACY_IN_PROGRESS_STATUS) {
		return "in_progress";
	}
	return status === LEGACY_PR_CREATED_STATUS ||
		(LEGACY_REVIEW_STATUSES as readonly string[]).includes(status)
		? "in_review"
		: status;
}

function mapMutationError(error: unknown) {
	return isForeignKeyError(error)
		? { status: "foreign_key_error" as const }
		: { status: "invalid_payload" as const };
}
