import type { AppDeps, RouteHandler } from "./app.types";
import { handleCliRoute } from "./http/cli-routes";
import { handleProjectsRoute } from "./http/projects-routes";
import { handleTasksRoute } from "./http/tasks-routes";

export function createHandleRequest(deps: AppDeps): RouteHandler {
	return async (request) => {
		if (matchesPath(request, "/health")) {
			const methodResult = ensureMethod(request, "GET");
			if (methodResult.status === "error") {
				return methodResult.response;
			}
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

		return notFoundResponse();
	};
}

export const handleRequest: RouteHandler = (request) => {
	if (matchesPath(request, "/health")) {
		if (request.method !== "GET") {
			return methodNotAllowedResponse();
		}
		return jsonSuccess({ status: "ok" });
	}

	return notFoundResponse();
};
