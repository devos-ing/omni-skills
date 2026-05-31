import { loadSqliteEnv, saveSqliteEnv } from "devos/features/config";
import { badRequest } from "./http-utils";
import type {
	GitHubConnectionResponse,
	GitHubRepositoriesRouteDeps,
} from "./types/github-repositories-api.types";

const CLIENT_ID_KEY = "GITHUB_OAUTH_CLIENT_ID";
const CLIENT_SECRET_KEY = "GITHUB_OAUTH_CLIENT_SECRET";
const TOKEN_KEY = "GITHUB_OAUTH_ACCESS_TOKEN";
const LOGIN_KEY = "GITHUB_OAUTH_LOGIN";
const STATE_COOKIE = "devos_github_oauth_state";
const CALLBACK_PATH = "/api/github/oauth/callback";
const OAUTH_UNCONFIGURED = "GitHub OAuth is not configured";
const OAUTH_DISCONNECTED = "Connect GitHub to list repositories";

type RouteDeps = Required<Omit<GitHubRepositoriesRouteDeps, "env">> & {
	env: Record<string, string | undefined>;
};
type OAuthConfig = { clientId: string; clientSecret: string };
type StoredConnection = { login: string | null; token: string | null };

export async function getGitHubConnection(
	workspacePath: string,
	deps: GitHubRepositoriesRouteDeps,
): Promise<GitHubConnectionResponse> {
	const resolved = resolveDeps(deps);
	const store = await resolved.loadEnv(workspacePath);
	return connectionResponse(
		readConfig(resolved.env),
		readStoredConnection(store),
	);
}

export async function disconnectGitHub(
	workspacePath: string,
	deps: GitHubRepositoriesRouteDeps,
): Promise<GitHubConnectionResponse> {
	const resolved = resolveDeps(deps);
	await resolved.saveEnv(workspacePath, {
		[TOKEN_KEY]: undefined,
		[LOGIN_KEY]: undefined,
	});
	return connectionResponse(readConfig(resolved.env), {
		login: null,
		token: null,
	});
}

export function startGitHubOAuth(
	request: Request,
	deps: GitHubRepositoriesRouteDeps,
): Response {
	const resolved = resolveDeps(deps);
	const config = readConfig(resolved.env);
	if (!config) {
		return Response.json(
			connectionResponse(null, { login: null, token: null }),
			{ status: 503 },
		);
	}
	const state = resolved.randomState();
	const redirectUri = new URL(CALLBACK_PATH, request.url);
	const location = new URL("https://github.com/login/oauth/authorize");
	location.searchParams.set("client_id", config.clientId);
	location.searchParams.set("redirect_uri", redirectUri.toString());
	location.searchParams.set("scope", "repo");
	location.searchParams.set("state", state);
	return redirect(location.toString(), stateCookie(state, 600));
}

export async function finishGitHubOAuth(
	request: Request,
	workspacePath: string,
	deps: GitHubRepositoriesRouteDeps,
): Promise<Response> {
	const url = new URL(request.url);
	const code = value(url.searchParams.get("code"));
	const state = value(url.searchParams.get("state"));
	if (!code || !state || readCookie(request, STATE_COOKIE) !== state) {
		return badRequest("Invalid GitHub OAuth callback");
	}
	const resolved = resolveDeps(deps);
	const config = readConfig(resolved.env);
	if (!config) return oauthRedirect(request, "error");
	try {
		const token = await exchangeCode(
			resolved.fetchFn,
			config,
			code,
			request.url,
		);
		const login = await fetchLogin(resolved.fetchFn, token);
		await resolved.saveEnv(workspacePath, {
			[TOKEN_KEY]: token,
			[LOGIN_KEY]: login,
		});
		return oauthRedirect(request, "connected");
	} catch {
		return oauthRedirect(request, "error");
	}
}

async function exchangeCode(
	fetchFn: typeof fetch,
	config: OAuthConfig,
	code: string,
	requestUrl: string,
): Promise<string> {
	const payload = await fetchJson(
		fetchFn,
		"https://github.com/login/oauth/access_token",
		{
			method: "POST",
			headers: {
				accept: "application/json",
				"content-type": "application/json",
			},
			body: JSON.stringify({
				client_id: config.clientId,
				client_secret: config.clientSecret,
				code,
				redirect_uri: new URL(CALLBACK_PATH, requestUrl).toString(),
			}),
		},
	);
	const token = value((payload as Record<string, unknown>).access_token);
	if (!token) throw new Error("GitHub token exchange failed");
	return token;
}

async function fetchLogin(
	fetchFn: typeof fetch,
	token: string,
): Promise<string> {
	const payload = await fetchJson(fetchFn, "https://api.github.com/user", {
		headers: githubHeaders(token),
	});
	const login = value((payload as Record<string, unknown>).login);
	if (!login) throw new Error("GitHub user fetch failed");
	return login;
}

async function fetchJson(
	fetchFn: typeof fetch,
	input: RequestInfo | URL,
	init?: RequestInit,
): Promise<unknown> {
	const response = await fetchFn(input, init);
	if (!response.ok) throw new Error("GitHub request failed");
	return response.json();
}

function connectionResponse(
	config: OAuthConfig | null,
	store: StoredConnection,
): GitHubConnectionResponse {
	if (!config) return connection(false, false, null, OAUTH_UNCONFIGURED);
	if (!store.login || !store.token) {
		return connection(true, false, null, OAUTH_DISCONNECTED);
	}
	return connection(true, true, store.login, null);
}

function connection(
	isConfigured: boolean,
	isConnected: boolean,
	login: string | null,
	unavailableReason: string | null,
): GitHubConnectionResponse {
	return { isConfigured, isConnected, login, unavailableReason };
}

function resolveDeps(deps: GitHubRepositoriesRouteDeps): RouteDeps {
	return {
		env: deps.env ?? process.env,
		fetchFn: deps.fetchFn ?? fetch,
		loadEnv: deps.loadEnv ?? loadSqliteEnv,
		randomState: deps.randomState ?? crypto.randomUUID,
		saveEnv: deps.saveEnv ?? saveSqliteEnv,
	};
}

function readConfig(
	env: Record<string, string | undefined>,
): OAuthConfig | null {
	const clientId = value(env[CLIENT_ID_KEY]);
	const clientSecret = value(env[CLIENT_SECRET_KEY]);
	return clientId && clientSecret ? { clientId, clientSecret } : null;
}

function readStoredConnection(
	store: Record<string, string> | undefined,
): StoredConnection {
	return { login: value(store?.[LOGIN_KEY]), token: value(store?.[TOKEN_KEY]) };
}

function githubHeaders(token: string): Record<string, string> {
	return {
		accept: "application/vnd.github+json",
		authorization: `Bearer ${token}`,
	};
}

function value(input: unknown): string | null {
	return typeof input === "string" && input.trim() ? input.trim() : null;
}

function readCookie(request: Request, name: string): string | null {
	const encoded = request.headers
		.get("cookie")
		?.split(";")
		.map((cookie) => cookie.trim())
		.find((cookie) => cookie.startsWith(`${name}=`))
		?.slice(name.length + 1);
	return encoded ? decodeURIComponent(encoded) : null;
}

function stateCookie(state: string, maxAge: number): string {
	return `${STATE_COOKIE}=${encodeURIComponent(state)}; HttpOnly; SameSite=Lax; Path=/api/github/oauth; Max-Age=${maxAge}`;
}

function clearStateCookie(): string {
	return `${STATE_COOKIE}=; HttpOnly; SameSite=Lax; Path=/api/github/oauth; Max-Age=0`;
}

function oauthRedirect(
	request: Request,
	result: "connected" | "error",
): Response {
	return redirect(
		new URL(`/projects?github=${result}`, request.url).toString(),
		clearStateCookie(),
	);
}

function redirect(location: string, cookie: string): Response {
	return new Response(null, {
		status: 302,
		headers: { location, "set-cookie": cookie },
	});
}
