import {
	disconnectGitHub,
	finishGitHubOAuth,
	getGitHubConnection,
	startGitHubOAuth,
} from "./github-oauth-service";
import { listGitHubRepositories } from "./github-repositories-service";
import { methodNotAllowed } from "./http-utils";
import type { GitHubRepositoriesRouteDeps } from "./types/github-repositories-api.types";

const GITHUB_CONNECTION_PATH = "/api/github/connection";
const GITHUB_OAUTH_START_PATH = "/api/github/oauth/start";
const GITHUB_OAUTH_CALLBACK_PATH = "/api/github/oauth/callback";
const GITHUB_REPOSITORIES_PATH = "/api/github/repositories";
const KNOWN_PATHS = new Set([
	GITHUB_CONNECTION_PATH,
	GITHUB_OAUTH_START_PATH,
	GITHUB_OAUTH_CALLBACK_PATH,
	GITHUB_REPOSITORIES_PATH,
]);

export async function handleGitHubRepositoriesRoute(
	request: Request,
	pathname: string,
	workspacePath: string,
	deps: GitHubRepositoriesRouteDeps = {},
): Promise<Response | null> {
	if (!KNOWN_PATHS.has(pathname)) return null;
	if (pathname === GITHUB_CONNECTION_PATH && request.method === "GET") {
		return Response.json(await getGitHubConnection(workspacePath, deps));
	}
	if (pathname === GITHUB_CONNECTION_PATH && request.method === "DELETE") {
		return Response.json(await disconnectGitHub(workspacePath, deps));
	}
	if (request.method !== "GET") return methodNotAllowed();
	if (pathname === GITHUB_OAUTH_START_PATH) {
		return startGitHubOAuth(request, deps);
	}
	if (pathname === GITHUB_OAUTH_CALLBACK_PATH) {
		return finishGitHubOAuth(request, workspacePath, deps);
	}
	return Response.json(await listGitHubRepositories(workspacePath, deps));
}
