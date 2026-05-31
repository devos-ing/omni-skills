import type { ServerDatabase } from "devos-db";
import { defaultLocalWorkspace } from "../local-workspace";
import { parseNotificationServerRequest } from "../notifications/notification-server-request";
import { parseNotificationRequest } from "../notifications/notifications-request";
import { READ_ONLY_SERVER_PATHS, handleServerRequest } from "../routes";
import { handleEntityCrudRequest, matchCrudRoute } from "../routes/entity-crud";
import type { AppDeps } from "../types/app.types";
import { handleChatRoute } from "./chat-routes";
import { handleCliRoute } from "./cli-routes";
import { handleGitHubRepositoriesRoute } from "./github-repositories-routes";
import { handleInboxMessagesRoute } from "./inbox-routes";
import { handlePollingStatusRoute } from "./polling-status-routes";
import { handleProjectsRoute } from "./projects-routes";
import {
	badRequestResponse,
	jsonError,
	jsonSuccess,
	methodNotAllowedResponse,
	serverErrorResponse,
} from "./response";
import { handleSettingsRoute } from "./settings-routes";
import { handleTasksRoute } from "./tasks-routes";
import type { RouteRegistryEntry } from "./types/route-registry.types";
import { handleWorkspaceBoardRoute } from "./workspace-board-routes";
import { handleWorkspaceEnvironmentRoute } from "./workspace-environment-routes";

type DbRouteHandler = (
	db: ServerDatabase["db"],
	request: Request,
	pathname: string,
) => Promise<Response | null>;

export function createAppRoutes(deps: AppDeps): RouteRegistryEntry[] {
	const workspace = deps.workspace ?? defaultLocalWorkspace();
	const workspacePath = deps.workspacePath ?? process.cwd();
	return [
		...createHealthRoutes(),
		route("workspace-current", (request, { pathname }) => {
			if (pathname !== "/api/workspace/current" || request.method !== "GET") {
				return null;
			}
			return jsonSuccess({
				workspaceId: workspace.id,
				name: workspace.name,
			});
		}),
		route(
			"workspace-environment",
			async (request, { pathname }) =>
				(await handleWorkspaceEnvironmentRoute(
					request,
					deps.db,
					pathname,
					workspacePath,
					workspace,
				)) ?? null,
		),
		route("cli", (request, { pathname }) =>
			handleCliRoute(request, deps.cliExecutor, pathname),
		),
		dbRoute("chat", deps, (db, request, pathname) =>
			handleChatRoute(
				request,
				db,
				pathname,
				workspacePath,
				workspace,
				deps.cliExecutor,
				deps.realtimeEvents,
			),
		),
		dbRoute("polling-status", deps, (db, request, pathname) =>
			handlePollingStatusRoute(request, db, pathname),
		),
		dbRoute("projects", deps, (db, request, pathname) =>
			handleProjectsRoute(request, db, deps.realtimeEvents, pathname),
		),
		dbRoute("tasks", deps, (db, request, pathname) =>
			handleTasksRoute(
				request,
				db,
				deps.cliExecutor,
				deps.realtimeEvents,
				pathname,
			),
		),
		dbRoute("inbox", deps, (db, request, pathname) =>
			handleInboxMessagesRoute(request, db, deps.realtimeEvents, pathname),
		),
		route("workspace-board", (request, { pathname }) =>
			handleWorkspaceBoardRoute(request, deps.boardRepository, pathname),
		),
		route("settings", (request, { pathname }) =>
			handleSettingsRoute(request, pathname, workspacePath),
		),
		route("github-repositories", (request, { pathname }) =>
			handleGitHubRepositoriesRoute(request, pathname, workspacePath),
		),
		route("entity-crud", (request, { pathname }) =>
			handleEntityCrudRoute(request, deps, pathname, workspacePath),
		),
		route("notifications", (request, { pathname }) =>
			handleNotificationRoute(request, deps, pathname),
		),
		route("read-only-server", (request, { pathname }) =>
			handleReadOnlyServerRoute(request, deps, pathname),
		),
	];
}

export function createHealthRoutes(): RouteRegistryEntry[] {
	return [
		route("health", (request, { pathname }) =>
			pathname === "/health" && request.method === "GET"
				? jsonSuccess({ status: "ok" })
				: null,
		),
	];
}

function route(
	name: string,
	handle: RouteRegistryEntry["handle"],
): RouteRegistryEntry {
	return { name, handle };
}

function dbRoute(
	name: string,
	deps: AppDeps,
	handle: DbRouteHandler,
): RouteRegistryEntry {
	return route(name, (request, { pathname }) =>
		deps.db ? handle(deps.db, request, pathname) : null,
	);
}

async function handleEntityCrudRoute(
	request: Request,
	deps: AppDeps,
	pathname: string,
	workspacePath: string,
): Promise<Response | null> {
	const crudRoute = matchCrudRoute(pathname);
	if (!crudRoute) {
		return null;
	}
	if (!deps.db) {
		return serverErrorResponse("Server database not configured");
	}
	const result = await handleEntityCrudRequest(
		request,
		{
			db: deps.db,
			isRuntimeReachable: deps.cliExecutor.isRuntimeReachable,
			workspacePath,
		},
		crudRoute,
	);
	return result.body === undefined
		? new Response(null, { status: result.status })
		: jsonSuccess(result.body, { status: result.status });
}

async function handleNotificationRoute(
	request: Request,
	deps: AppDeps,
	pathname: string,
): Promise<Response | null> {
	if (pathname === "/api/notifications") {
		return handleNotificationServerRoute(request, deps);
	}
	if (pathname === "/api/notifications/email") {
		return handleNotificationEmailRoute(request, deps);
	}
	return null;
}

async function handleNotificationServerRoute(
	request: Request,
	deps: AppDeps,
): Promise<Response> {
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

async function handleNotificationEmailRoute(
	request: Request,
	deps: AppDeps,
): Promise<Response> {
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

function handleReadOnlyServerRoute(
	request: Request,
	deps: AppDeps,
	pathname: string,
): Response | Promise<Response> | null {
	if (!(READ_ONLY_SERVER_PATHS as readonly string[]).includes(pathname)) {
		return null;
	}
	if (!deps.repositories) {
		return serverErrorResponse("Read repositories not configured");
	}
	return handleServerRequest(request, { repositories: deps.repositories });
}
