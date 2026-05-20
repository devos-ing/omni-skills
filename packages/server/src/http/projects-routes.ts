import type { ServerDatabase } from "devos-db";
import { createProjectRepository, createProjectService } from "../projects";
import type { ProjectServiceResult } from "../projects";
import {
	type RealtimeEventPublisher,
	toRealtimeProjectRecord,
} from "../realtime";
import {
	badRequest,
	methodNotAllowed,
	notFound,
	parseObjectJsonBody,
	readPathId,
} from "./http-utils";
import {
	parseCreateProjectPayload,
	parseUpdateProjectPayload,
} from "./project-task-schemas";

export async function handleProjectsRoute(
	request: Request,
	db: ServerDatabase["db"],
	realtimeEvents: RealtimeEventPublisher | undefined,
	pathname: string,
): Promise<Response | null> {
	const service = createProjectService(createProjectRepository(db));
	if (pathname === "/api/projects") {
		if (request.method === "GET") {
			return mapProjectResult(
				await service.listProjects(),
				"Invalid project list",
			);
		}
		if (request.method === "POST") {
			const parsedBody = await parseObjectJsonBody(request);
			if (!parsedBody.ok) {
				return badRequest(parsedBody.error);
			}
			const payload = parseCreateProjectPayload(parsedBody.value);
			if (!payload.ok) {
				return badRequest(payload.error);
			}
			const result = await service.createProject(payload.value);
			publishProjectEvent(realtimeEvents, "project.created", result);
			return mapProjectResult(result, "Invalid project create payload", 201);
		}
		return methodNotAllowed();
	}
	if (pathname === "/api/projects/") {
		return notFound("Project not found");
	}

	const id = readPathId(pathname, "/api/projects/");
	if (!id) {
		return null;
	}

	if (request.method === "GET") {
		return mapProjectResult(
			await service.getProject(id),
			"Invalid project read payload",
		);
	}

	if (request.method === "PATCH") {
		const parsedBody = await parseObjectJsonBody(request);
		if (!parsedBody.ok) {
			return badRequest(parsedBody.error);
		}
		const payload = parseUpdateProjectPayload(parsedBody.value);
		if (!payload.ok) {
			return badRequest(payload.error);
		}
		const result = await service.updateProject(id, payload.value);
		publishProjectEvent(realtimeEvents, "project.updated", result);
		return mapProjectResult(result, "Invalid project update payload");
	}

	if (request.method === "DELETE") {
		const result = await service.deleteProject(id);
		publishProjectEvent(realtimeEvents, "project.deleted", result);
		return mapProjectResult(result, "Invalid project delete payload");
	}

	return methodNotAllowed();
}

function mapProjectResult<T>(
	result: ProjectServiceResult<T>,
	invalidPayloadError: string,
	successStatus = 200,
): Response {
	if (result.status === "ok") {
		return Response.json(result.value, { status: successStatus });
	}
	if (result.status === "not_found") {
		return notFound("Project not found");
	}
	if (result.status === "foreign_key_error") {
		return badRequest("Foreign key constraint failed");
	}
	return badRequest(
		invalidPayloadError === "Invalid project update payload"
			? "Update payload must include at least one field"
			: invalidPayloadError,
	);
}

function publishProjectEvent(
	realtimeEvents: RealtimeEventPublisher | undefined,
	type: "project.created" | "project.updated" | "project.deleted",
	result: ProjectServiceResult<Parameters<typeof toRealtimeProjectRecord>[0]>,
): void {
	if (result.status === "ok") {
		realtimeEvents?.publish({
			type,
			project: toRealtimeProjectRecord(result.value),
		});
	}
}
