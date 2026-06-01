import { searchGitHubRepositories } from "../github";
import {
	badRequestResponse,
	jsonError,
	jsonSuccess,
	methodNotAllowedResponse,
} from "./response";

export async function handleGitHubRoute(
	request: Request,
	pathname: string,
	fetchFn?: typeof fetch,
): Promise<Response | null> {
	if (pathname !== "/api/github/repositories/search") {
		return null;
	}
	if (request.method !== "GET") {
		return methodNotAllowedResponse();
	}
	const query = new URL(request.url).searchParams.get("q") ?? "";
	const result = await searchGitHubRepositories({ query, fetchFn });
	if (result.status === "ok") {
		return jsonSuccess({ repositories: result.repositories });
	}
	if (result.status === "invalid_query") {
		return badRequestResponse("Repository query is required");
	}
	if (result.status === "auth_unavailable") {
		return jsonError("GitHub repository search is not authenticated", {
			status: 503,
		});
	}
	if (result.status === "rate_limited") {
		return jsonError("GitHub repository search is rate limited", {
			status: 429,
		});
	}
	return jsonError("GitHub repository search is unavailable", { status: 502 });
}
