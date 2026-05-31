import { loadSqliteEnv } from "devos/features/config";
import type {
	GitHubRepositoriesResponse,
	GitHubRepositoriesRouteDeps,
	GitHubRepositoryRecord,
} from "./types/github-repositories-api.types";

const CLIENT_ID_KEY = "GITHUB_OAUTH_CLIENT_ID";
const CLIENT_SECRET_KEY = "GITHUB_OAUTH_CLIENT_SECRET";
const TOKEN_KEY = "GITHUB_OAUTH_ACCESS_TOKEN";
const LOGIN_KEY = "GITHUB_OAUTH_LOGIN";
const REPOS_URL =
	"https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member";
const REPOS_UNAVAILABLE = "GitHub repositories unavailable";
const OAUTH_UNCONFIGURED = "GitHub OAuth is not configured";
const OAUTH_DISCONNECTED = "Connect GitHub to list repositories";

export async function listGitHubRepositories(
	workspacePath: string,
	deps: GitHubRepositoriesRouteDeps,
): Promise<GitHubRepositoriesResponse> {
	const env = deps.env ?? process.env;
	const loadEnv = deps.loadEnv ?? loadSqliteEnv;
	const tokenStore = await loadEnv(workspacePath);
	const token = value(tokenStore?.[TOKEN_KEY]);
	const login = value(tokenStore?.[LOGIN_KEY]);
	if (!value(env[CLIENT_ID_KEY]) || !value(env[CLIENT_SECRET_KEY])) {
		return unavailable(OAUTH_UNCONFIGURED);
	}
	if (!token || !login) return unavailable(OAUTH_DISCONNECTED);
	try {
		const payload = await fetchRepositories(deps.fetchFn ?? fetch, token);
		if (!Array.isArray(payload)) return unavailable(REPOS_UNAVAILABLE);
		return {
			isAvailable: true,
			unavailableReason: null,
			repositories: payload.flatMap(parseRepository),
		};
	} catch {
		return unavailable(REPOS_UNAVAILABLE);
	}
}

async function fetchRepositories(
	fetchFn: typeof fetch,
	token: string,
): Promise<unknown> {
	const response = await fetchFn(REPOS_URL, {
		headers: {
			accept: "application/vnd.github+json",
			authorization: `Bearer ${token}`,
		},
	});
	if (!response.ok) throw new Error("GitHub repositories unavailable");
	return response.json();
}

function parseRepository(value: unknown): GitHubRepositoryRecord[] {
	if (typeof value !== "object" || value === null) return [];
	const repo = value as Record<string, unknown> & {
		owner?: { login?: unknown } | null;
	};
	if (
		typeof repo.owner?.login !== "string" ||
		typeof repo.name !== "string" ||
		typeof repo.full_name !== "string" ||
		(repo.id !== undefined && typeof repo.id !== "number")
	) {
		return [];
	}
	return [
		{
			id: typeof repo.id === "number" ? String(repo.id) : repo.full_name,
			owner: repo.owner.login,
			name: repo.name,
			nameWithOwner: repo.full_name,
			defaultBranch:
				typeof repo.default_branch === "string" ? repo.default_branch : null,
			isPrivate: repo.private === true,
		},
	];
}

function unavailable(unavailableReason: string): GitHubRepositoriesResponse {
	return { isAvailable: false, unavailableReason, repositories: [] };
}

function value(input: unknown): string | null {
	return typeof input === "string" && input.trim() ? input.trim() : null;
}
