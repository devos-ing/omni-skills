import type { ServerRouteDeps } from "./routes.types";

type RouteHandler = (deps: ServerRouteDeps) => unknown;

export const READ_ONLY_SERVER_PATHS = [
	"/api/token-usage",
	"/api/jobs",
	"/api/agents",
	"/api/skills",
	"/api/command-history",
] as const;

const routes: Record<string, RouteHandler> = {
	"/api/token-usage": (deps) => deps.repositories.listTokenUsage(),
	"/api/jobs": (deps) => deps.repositories.listJobs(),
	"/api/agents": (deps) => deps.repositories.listAgents(),
	"/api/skills": (deps) => deps.repositories.listSkills(),
	"/api/command-history": (deps) => deps.repositories.listCommandHistory(),
};

function json(body: unknown, status = 200): Response {
	return Response.json(body, { status });
}

export async function handleServerRequest(
	request: Request,
	deps: ServerRouteDeps,
): Promise<Response> {
	if (request.method !== "GET") {
		return json({ error: "Method Not Allowed" }, 405);
	}

	const url = new URL(request.url);
	const handler = routes[url.pathname];
	if (!handler) {
		return json({ error: "Not Found" }, 404);
	}

	try {
		return json(handler(deps), 200);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return json({ error: message }, 500);
	}
}
