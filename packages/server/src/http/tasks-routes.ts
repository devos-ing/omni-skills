import { eq } from "drizzle-orm";
import type { CliExecutor } from "../app.types";
import type { ServerDatabase } from "../db";
import {
	boardProjectsTable,
	boardTasksTable,
	generateBoardTaskKey,
} from "../db";
import {
	badRequest,
	isForeignKeyError,
	methodNotAllowed,
	notFound,
	parseObjectJsonBody,
	readPathId,
} from "./http-utils";
import {
	isNonEmptyObject,
	parseCreateTaskPayload,
	parseUpdateTaskPayload,
} from "./project-task-schemas";
import { handleTaskChatCreateRoute } from "./task-chat-create";

export async function handleTasksRoute(
	request: Request,
	db: ServerDatabase["db"],
	cliExecutor: CliExecutor,
	pathname: string,
): Promise<Response | null> {
	if (pathname === "/api/tasks/chat-create") {
		return handleTaskChatCreateRoute(request, db, cliExecutor);
	}

	if (pathname === "/api/tasks") {
		if (request.method === "GET") {
			return Response.json(await db.select().from(boardTasksTable));
		}
		if (request.method === "POST") {
			const parsedBody = await parseObjectJsonBody(request);
			if (!parsedBody.ok) {
				return badRequest(parsedBody.error);
			}
			const payload = parseCreateTaskPayload(parsedBody.value);
			if (!payload.ok) {
				return badRequest(payload.error);
			}
			if (payload.value.projectId) {
				const [project] = await db
					.select({ id: boardProjectsTable.id })
					.from(boardProjectsTable)
					.where(eq(boardProjectsTable.id, payload.value.projectId));
				if (!project) {
					return badRequest("Foreign key constraint failed");
				}
			}
			const now = new Date().toISOString();
			try {
				const [created] = await db
					.insert(boardTasksTable)
					.values({
						id: crypto.randomUUID(),
						taskKey: payload.value.taskKey ?? (await generateBoardTaskKey(db)),
						projectId: payload.value.projectId ?? null,
						title: payload.value.title,
						content: payload.value.content,
						priority: payload.value.priority,
						status: payload.value.status,
						dueDate: payload.value.dueDate ?? null,
						creatorId: payload.value.creatorId,
						linkedPr: payload.value.linkedPr ?? null,
						linearIssueId: payload.value.linearIssueId ?? null,
						linearIdentifier: payload.value.linearIdentifier ?? null,
						linearUrl: payload.value.linearUrl ?? null,
						createdAt: now,
						updatedAt: now,
					})
					.returning();
				return Response.json(created, { status: 201 });
			} catch (error) {
				return isForeignKeyError(error)
					? badRequest("Foreign key constraint failed")
					: badRequest("Invalid task create payload");
			}
		}
		return methodNotAllowed();
	}
	if (pathname === "/api/tasks/") {
		return notFound("Task not found");
	}

	const id = readPathId(pathname, "/api/tasks/");
	if (!id) {
		return null;
	}

	if (request.method === "GET") {
		const [task] = await db
			.select()
			.from(boardTasksTable)
			.where(eq(boardTasksTable.id, id));
		return task ? Response.json(task) : notFound("Task not found");
	}

	if (request.method === "PATCH") {
		const parsedBody = await parseObjectJsonBody(request);
		if (!parsedBody.ok) {
			return badRequest(parsedBody.error);
		}
		const payload = parseUpdateTaskPayload(parsedBody.value);
		if (!payload.ok) {
			return badRequest(payload.error);
		}
		if (!isNonEmptyObject(payload.value)) {
			return badRequest("Update payload must include at least one field");
		}
		if (payload.value.projectId) {
			const [project] = await db
				.select({ id: boardProjectsTable.id })
				.from(boardProjectsTable)
				.where(eq(boardProjectsTable.id, payload.value.projectId));
			if (!project) {
				return badRequest("Foreign key constraint failed");
			}
		}
		try {
			const [updated] = await db
				.update(boardTasksTable)
				.set({ ...payload.value, updatedAt: new Date().toISOString() })
				.where(eq(boardTasksTable.id, id))
				.returning();
			return updated ? Response.json(updated) : notFound("Task not found");
		} catch (error) {
			return isForeignKeyError(error)
				? badRequest("Foreign key constraint failed")
				: badRequest("Invalid task update payload");
		}
	}

	if (request.method === "DELETE") {
		try {
			const [deleted] = await db
				.delete(boardTasksTable)
				.where(eq(boardTasksTable.id, id))
				.returning();
			return deleted ? Response.json(deleted) : notFound("Task not found");
		} catch (error) {
			return isForeignKeyError(error)
				? badRequest("Foreign key constraint failed")
				: badRequest("Invalid task delete payload");
		}
	}

	return methodNotAllowed();
}
