import type { AppDeps, RouteHandler } from "./app.types";
import { handleCliRoute } from "./http/cli-routes";
import { handleInboxMessagesRoute } from "./http/inbox-routes";
import { handleProjectsRoute } from "./http/projects-routes";
import { withRequestLogging } from "./http/request-logger";
import {
	badRequestResponse,
	jsonError,
	jsonSuccess,
	methodNotAllowedResponse,
	notFoundJsonResponse,
	serverErrorResponse,
} from "./http/response";
import { handleTasksRoute } from "./http/tasks-routes";
import { parseNotificationServerRequest } from "./notifications/notification-server-request";
import { parseNotificationRequest } from "./notifications/notifications-request";
import { READ_ONLY_SERVER_PATHS, handleServerRequest } from "./routes";
import { handleEntityCrudRequest, matchCrudRoute } from "./routes/entity-crud";

const WORKSPACE_PROJECTS_ROUTE = /^\/api\/workspaces\/([^/]+)\/projects\/?$/;
const WORKSPACE_PROJECT_BOARD_ROUTE =
	/^\/api\/workspaces\/([^/]+)\/projects\/([^/]+)\/board\/?$/;

export function createHandleRequest(deps: AppDeps): RouteHandler {
	const handler: RouteHandler = async (request) => {
		const { pathname } = new URL(request.url);

		if (pathname === "/health" && request.method === "GET") {
			return jsonSuccess({ status: "ok" });
		}

		const cliResponse = await handleCliRoute(
			request,
			deps.cliExecutor,
			pathname,
			deps.logger,
		);
		if (cliResponse) {
			return cliResponse;
		}

		if (deps.db) {
			const projectResponse = await handleProjectsRoute(
				request,
				deps.db,
				pathname,
			);
			if (projectResponse) {
				return projectResponse;
			}
		}

		if (deps.db) {
			const taskResponse = await handleTasksRoute(request, deps.db, pathname);
			if (taskResponse) {
				return taskResponse;
			}
		}

		if (deps.db) {
			const inboxResponse = await handleInboxMessagesRoute(
				request,
				deps.db,
				pathname,
			);
			if (inboxResponse) {
				return inboxResponse;
			}
		}

		const projectMatch = pathname.match(WORKSPACE_PROJECTS_ROUTE);
		if (projectMatch) {
			if (request.method !== "GET") {
				return methodNotAllowedResponse();
			}
			if (!deps.boardRepository) {
				return serverErrorResponse("Board repository not configured");
			}
			const workspaceId = decodeURIComponent(projectMatch[1] ?? "");
			if (workspaceId.length === 0) {
				return notFoundJsonResponse();
			}
			const projects =
				await deps.boardRepository.listWorkspaceProjects(workspaceId);
			return jsonSuccess({ workspaceId, projects });
		}

		const boardMatch = pathname.match(WORKSPACE_PROJECT_BOARD_ROUTE);
		if (boardMatch) {
			if (request.method !== "GET") {
				return methodNotAllowedResponse();
			}
			if (!deps.boardRepository) {
				return serverErrorResponse("Board repository not configured");
			}
			const workspaceId = decodeURIComponent(boardMatch[1] ?? "");
			const projectId = decodeURIComponent(boardMatch[2] ?? "");
			if (workspaceId.length === 0 || projectId.length === 0) {
				return notFoundJsonResponse();
			}
			const board = await deps.boardRepository.getWorkspaceProjectBoard(
				workspaceId,
				projectId,
			);
			if (!board) {
				return notFoundJsonResponse();
			}
			return jsonSuccess(board);
		}

		const crudRoute = matchCrudRoute(pathname);
		if (crudRoute) {
			if (!deps.db) {
				return serverErrorResponse("Server database not configured");
			}
			const result = await handleEntityCrudRequest(
				request,
				{ db: deps.db },
				crudRoute,
			);
			if (result?.body === undefined) {
				return new Response(null, { status: result.status });
			}
			return jsonSuccess(result.body, { status: result.status });
		}

		if (pathname === "/api/notifications") {
			if (request.method !== "POST") {
				return methodNotAllowedResponse();
			}
			const parsed = await parseNotificationServerRequest(request);
			if (parsed.status === "error") {
				return badRequestResponse(parsed.error);
			}
			if (!deps.notificationSender) {
				return serverErrorResponse("Notification sender not configured");
			}
			await deps.notificationSender.sendNotification(parsed.request);
			return jsonSuccess({ status: "accepted" }, { status: 202 });
		}

		if (pathname === "/api/notifications/email") {
			if (request.method !== "POST") {
				return methodNotAllowedResponse();
			}
			const parsed = await parseNotificationRequest(request);
			if (parsed.status === "error") {
				return badRequestResponse(parsed.error);
			}
			if (!deps.notificationService) {
				return serverErrorResponse("Notification service not configured");
			}
			const result = await deps.notificationService.send(parsed.request);
			if (result.status === "config_error") {
				return jsonError(result.error, { status: 503 });
			}
			if (result.status === "send_error") {
				return jsonError(result.error, { status: 502 });
			}
			return jsonSuccess({ status: "sent" }, { status: 200 });
		}

		if ((READ_ONLY_SERVER_PATHS as readonly string[]).includes(pathname)) {
			if (!deps.repositories) {
				return serverErrorResponse("Read repositories not configured");
			}
			return handleServerRequest(request, { repositories: deps.repositories });
		}

		return new Response("Not Found", { status: 404 });
	};
	return deps.logger ? withRequestLogging(handler, deps.logger) : handler;
}

export const handleRequest: RouteHandler = async (request) => {
	const { pathname } = new URL(request.url);

	if (pathname === "/health" && request.method === "GET") {
		return jsonSuccess({ status: "ok" });
	}

	return new Response("Not Found", { status: 404 });
};
