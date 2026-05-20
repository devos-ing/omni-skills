import type { ServerDatabase } from "devos-db";
import type { CliExecutor } from "../app.types";
import type { RealtimeEventPublisher } from "../realtime";
import { createTaskRepository, createTaskService } from "../tasks";
import {
	badRequest,
	methodNotAllowed,
	notFound,
	parseObjectJsonBody,
	readPathId,
} from "./http-utils";
import {
	parseCreateTaskPayload,
	parseUpdateTaskPayload,
} from "./project-task-schemas";
import { handleTaskChatCreateRoute } from "./task-chat-create";
import { mapTaskResult, readTaskActivityPath } from "./task-route-utils";

export async function handleTasksRoute(
	request: Request,
	db: ServerDatabase["db"],
	cliExecutor: CliExecutor,
	realtimeEvents: RealtimeEventPublisher | undefined,
	pathname: string,
): Promise<Response | null> {
	if (pathname === "/api/tasks/chat-create") {
		return handleTaskChatCreateRoute(request, db, cliExecutor, realtimeEvents);
	}

	const service = createTaskService(createTaskRepository(db));
	if (pathname === "/api/tasks") {
		if (request.method === "GET") {
			return mapTaskResult(await service.listTasks(), "Invalid task list");
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
			const result = await service.createTask(payload.value);
			publishTaskEvent(realtimeEvents, "issue.created", result);
			return mapTaskResult(result, "Invalid task create payload", 201);
		}
		return methodNotAllowed();
	}
	if (pathname === "/api/tasks/") {
		return notFound("Task not found");
	}

	const activityTaskId = readTaskActivityPath(pathname);
	if (activityTaskId) {
		if (request.method === "GET") {
			return mapTaskResult(
				await service.getTaskActivity(activityTaskId),
				"Invalid task activity payload",
			);
		}
		return methodNotAllowed();
	}

	const id = readPathId(pathname, "/api/tasks/");
	if (!id) {
		return null;
	}

	if (request.method === "GET") {
		return mapTaskResult(
			await service.getTask(id),
			"Invalid task read payload",
		);
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
		const result = await service.updateTask(id, payload.value);
		publishTaskEvent(realtimeEvents, "issue.updated", result);
		return mapTaskResult(result, "Invalid task update payload");
	}

	if (request.method === "DELETE") {
		const result = await service.deleteTask(id);
		publishTaskEvent(realtimeEvents, "issue.deleted", result);
		return mapTaskResult(result, "Invalid task delete payload");
	}

	return methodNotAllowed();
}

function publishTaskEvent(
	realtimeEvents: RealtimeEventPublisher | undefined,
	type: "issue.created" | "issue.updated" | "issue.deleted",
	result: Awaited<
		ReturnType<ReturnType<typeof createTaskService>["createTask"]>
	>,
): void {
	if (result.status === "ok") {
		realtimeEvents?.publish({ type, issue: result.value });
	}
}
