import type {
	NotificationEmailPayload,
	NotificationServerRequest,
} from "adhdai/features/server";
import type { AppDeps, RouteHandler } from "./app.types";
import { parseNotificationRequest } from "./notifications/notifications-request";

const UNSAFE_RAW_COMMAND_FIELDS = ["command", "cmd", "args", "argv", "shell"];
const WORKSPACE_PROJECTS_ROUTE = /^\/api\/workspaces\/([^/]+)\/projects\/?$/;
const WORKSPACE_PROJECT_BOARD_ROUTE =
	/^\/api\/workspaces\/([^/]+)\/projects\/([^/]+)\/board\/?$/;

export function createHandleRequest(deps: AppDeps): RouteHandler {
	const boardReadModels = deps.boardReadModels;

	return async (request) => {
		const { pathname } = new URL(request.url);
		const workspaceProjectsMatch = pathname.match(WORKSPACE_PROJECTS_PATTERN);
		const projectBoardMatch = pathname.match(PROJECT_BOARD_PATTERN);

		const cliResponse = await handleCliRoute(
			request,
			deps.cliExecutor,
			pathname,
		);
		if (cliResponse) {
			return cliResponse;
		}
		if (workspaceProjectsMatch) {
			if (request.method !== "GET") {
				return Response.json({ error: "Method Not Allowed" }, { status: 405 });
			}
			if (!boardReadModels) {
				return Response.json(
					{ error: "Board read models not configured" },
					{ status: 500 },
				);
			}
			const workspaceId = decodeURIComponent(workspaceProjectsMatch[1] ?? "");
			return Response.json(
				await boardReadModels.listWorkspaceProjects(workspaceId),
			);
		}
		if (projectBoardMatch) {
			if (request.method !== "GET") {
				return Response.json({ error: "Method Not Allowed" }, { status: 405 });
			}
			if (!boardReadModels) {
				return Response.json(
					{ error: "Board read models not configured" },
					{ status: 500 },
				);
			}
			const workspaceId = decodeURIComponent(projectBoardMatch[1] ?? "");
			const projectId = decodeURIComponent(projectBoardMatch[2] ?? "");
			return Response.json(
				await boardReadModels.getProjectBoard(workspaceId, projectId),
			);
		}

		const projectResponse = await handleProjectsRoute(
			request,
			deps.db,
			pathname,
		);
		if (projectResponse) {
			return projectResponse;
		}

		const taskResponse = await handleTasksRoute(request, deps.db, pathname);
		if (taskResponse) {
			return taskResponse;
		}

		const crudRoute = matchCrudRoute(pathname);
		if (crudRoute) {
			const result = await handleEntityCrudRequest(request, deps, crudRoute);
			if (result?.body === undefined) {
				return new Response(null, { status: result.status });
			}
			return Response.json(result.body, { status: result.status });
		}
		const projectMatch = pathname.match(WORKSPACE_PROJECTS_ROUTE);
		if (projectMatch) {
			if (request.method !== "GET") {
				return Response.json({ error: "Method Not Allowed" }, { status: 405 });
			}
			const workspaceId = decodeURIComponent(projectMatch[1] ?? "");
			if (workspaceId.length === 0) {
				return Response.json({ error: "Not Found" }, { status: 404 });
			}
			const projects =
				await deps.boardRepository.listWorkspaceProjects(workspaceId);
			return Response.json({ workspaceId, projects });
		}

		const boardMatch = pathname.match(WORKSPACE_PROJECT_BOARD_ROUTE);
		if (boardMatch) {
			if (request.method !== "GET") {
				return Response.json({ error: "Method Not Allowed" }, { status: 405 });
			}
			const workspaceId = decodeURIComponent(boardMatch[1] ?? "");
			const projectId = decodeURIComponent(boardMatch[2] ?? "");
			if (workspaceId.length === 0 || projectId.length === 0) {
				return Response.json({ error: "Not Found" }, { status: 404 });
			}
			const board = await deps.boardRepository.getWorkspaceProjectBoard(
				workspaceId,
				projectId,
			);
			if (!board) {
				return Response.json({ error: "Not Found" }, { status: 404 });
			}
			return Response.json(board);
		}

		if (pathname === "/api/notifications") {
			if (request.method !== "POST") {
				return Response.json({ error: "Method Not Allowed" }, { status: 405 });
			}
			const parsed = await parseNotificationRequest(request);
			if (parsed.status === "error") {
				return Response.json({ error: parsed.error }, { status: 400 });
			}
			await deps.notificationSender.sendNotification(parsed.request);
			return Response.json({ status: "accepted" }, { status: 202 });
		}

		if (pathname === "/api/notifications/email") {
			if (request.method !== "POST") {
				return Response.json({ error: "Method Not Allowed" }, { status: 405 });
			}
			const parsed = await parseNotificationRequest(request);
			if (parsed.status === "error") {
				return Response.json({ error: parsed.error }, { status: 400 });
			}
			const result = await deps.notificationService.send(parsed.request);
			if (result.status === "config_error") {
				return Response.json({ error: result.error }, { status: 503 });
			}
			if (result.status === "send_error") {
				return Response.json({ error: result.error }, { status: 502 });
			}
			return Response.json({ status: "sent" }, { status: 200 });
		}

		return new Response("Not Found", { status: 404 });
	};
}

export const handleRequest: RouteHandler = async (request) => {
	const { pathname } = new URL(request.url);

	if (pathname === "/health" && request.method === "GET") {
		return Response.json({ status: "ok" });
	}

	return new Response("Not Found", { status: 404 });
};

async function parseDispatchRequest(
	request: Request,
): Promise<
	| { status: "ok"; request: Record<string, unknown> & { action: string } }
	| { status: "error"; error: string }
> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return { status: "error", error: "Malformed JSON body" };
	}

	if (!isRecord(body)) {
		return {
			status: "error",
			error: "Malformed dispatch request: expected object body",
		};
	}
	if (typeof body.action !== "string" || body.action.trim().length === 0) {
		return {
			status: "error",
			error: "Malformed dispatch request: action must be a non-empty string",
		};
	}
	for (const field of UNSAFE_RAW_COMMAND_FIELDS) {
		if (field in body) {
			return {
				status: "error",
				error: `Unsafe dispatch request: raw command field '${field}' is not allowed`,
			};
		}
		return jsonSuccess({ status: "ok" });
	}

	return {
		status: "ok",
		request: body as Record<string, unknown> & { action: string },
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function parseNotificationRequest(
	request: Request,
): Promise<
	| { status: "ok"; request: NotificationServerRequest }
	| { status: "error"; error: string }
> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return { status: "error", error: "Malformed JSON body" };
	}
	if (!isRecord(body)) {
		return {
			status: "error",
			error: "Malformed notification request: expected object body",
		};
	}
	const payload = body.payload;
	if (!isNotificationEmailPayload(payload)) {
		return {
			status: "error",
			error:
				"Malformed notification request: payload must include from, to, subject, and text",
		};
	}
	if (body.type === "task-outcome") {
		return {
			status: "ok",
			request: { type: "task-outcome", payload },
		};
	}
	if (body.type === "human-review-required") {
		if (typeof body.complexityScore !== "number") {
			return {
				status: "error",
				error:
					"Malformed notification request: complexityScore must be a number",
			};
		}
		if (typeof body.reason !== "string" || body.reason.trim().length === 0) {
			return {
				status: "error",
				error:
					"Malformed notification request: reason must be a non-empty string",
			};
		}
		return {
			status: "ok",
			request: {
				type: "human-review-required",
				payload,
				complexityScore: body.complexityScore,
				reason: body.reason,
			},
		};
	}
	return {
		status: "error",
		error:
			"Malformed notification request: type must be 'task-outcome' or 'human-review-required'",
	};
}

function isNotificationEmailPayload(
	value: unknown,
): value is NotificationEmailPayload {
	if (!isRecord(value)) {
		return false;
	}
	if (typeof value.from !== "string") {
		return false;
	}
	if (
		!Array.isArray(value.to) ||
		!value.to.every((item) => typeof item === "string")
	) {
		return false;
	}
	if (typeof value.subject !== "string") {
		return false;
	}
	return typeof value.text === "string";
}
