import { handleChatRoute } from "./http/chat-routes";
import { handleCliRoute } from "./http/cli-routes";
import { handleInboxMessagesRoute } from "./http/inbox-routes";
import { handlePollingStatusRoute } from "./http/polling-status-routes";
import { handleProjectsRoute } from "./http/projects-routes";
import {
	badRequestResponse,
	jsonError,
	jsonSuccess,
	methodNotAllowedResponse,
	notFoundJsonResponse,
	serverErrorResponse,
} from "./http/response";
import { handleTasksRoute } from "./http/tasks-routes";
import { handleWorkspaceBoardRoute } from "./http/workspace-board-routes";
import { parseNotificationServerRequest } from "./notifications/notification-server-request";
import { parseNotificationRequest } from "./notifications/notifications-request";
import { READ_ONLY_SERVER_PATHS, handleServerRequest } from "./routes";
import { handleEntityCrudRequest, matchCrudRoute } from "./routes/entity-crud";
import type { AppDeps, RouteHandler } from "./types/app.types";

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
		);
		if (cliResponse) {
			return cliResponse;
		}

		if (deps.db) {
			const chatResponse = await handleChatRoute(
				request,
				deps.db,
				pathname,
				deps.workspacePath ?? process.cwd(),
				deps.realtimeEvents,
			);
			if (chatResponse) {
				return chatResponse;
			}
		}

		if (deps.db) {
			const pollingStatusResponse = await handlePollingStatusRoute(
				request,
				deps.db,
				pathname,
			);
			if (pollingStatusResponse) {
				return pollingStatusResponse;
			}
		}

		if (deps.db) {
			const projectResponse = await handleProjectsRoute(
				request,
				deps.db,
				deps.realtimeEvents,
				pathname,
			);
			if (projectResponse) {
				return projectResponse;
			}
		}

		if (deps.db) {
			const taskResponse = await handleTasksRoute(
				request,
				deps.db,
				deps.cliExecutor,
				deps.realtimeEvents,
				pathname,
			);
			if (taskResponse) {
				return taskResponse;
			}
		}

		if (deps.db) {
			const inboxResponse = await handleInboxMessagesRoute(
				request,
				deps.db,
				deps.realtimeEvents,
				pathname,
			);
			if (inboxResponse) {
				return inboxResponse;
			}
		}

		const workspaceBoardResponse = await handleWorkspaceBoardRoute(
			request,
			deps.boardRepository,
			pathname,
		);
		if (workspaceBoardResponse) {
			return workspaceBoardResponse;
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
	return handler;
}

export const handleRequest: RouteHandler = async (request) => {
	const { pathname } = new URL(request.url);

	if (pathname === "/health" && request.method === "GET") {
		return jsonSuccess({ status: "ok" });
	}

	return new Response("Not Found", { status: 404 });
};
