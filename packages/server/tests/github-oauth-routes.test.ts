import { describe, expect, it } from "bun:test";
import { handleGitHubRepositoriesRoute } from "../src/http/github-repositories-routes";
import type { GitHubRepositoriesRouteDeps } from "../src/http/types/github-repositories-api.types";

const CONNECTED_STORE = {
	GITHUB_OAUTH_ACCESS_TOKEN: "token-123",
	GITHUB_OAUTH_LOGIN: "octo",
};

function connection(
	isConfigured: boolean,
	isConnected: boolean,
	login: string | null,
	unavailableReason: string | null,
) {
	return { isConfigured, isConnected, login, unavailableReason };
}

function createRouteDeps(options?: {
	env?: Record<string, string>;
	initialStore?: Record<string, string>;
	fetchFn?: typeof fetch;
}) {
	const store = { ...(options?.initialStore ?? {}) };
	const saves: Array<Record<string, string | undefined>> = [];
	const fetchFn = (async (input, init) =>
		options?.fetchFn?.(input, init) ??
		new Response("{}", { status: 500 })) as typeof fetch;
	const deps: GitHubRepositoriesRouteDeps = {
		env: options?.env ?? {
			GITHUB_OAUTH_CLIENT_ID: "client-id",
			GITHUB_OAUTH_CLIENT_SECRET: "client-secret",
		},
		fetchFn,
		loadEnv: async () => ({ ...store }),
		randomState: () => "state-123",
		saveEnv: async (_cwd, updates) => {
			saves.push(updates);
			for (const [key, value] of Object.entries(updates)) {
				if (value === undefined) {
					delete store[key];
					continue;
				}
				store[key] = value;
			}
		},
	};
	return { deps, saves };
}

async function route(
	pathname: string,
	deps: GitHubRepositoriesRouteDeps,
	init?: RequestInit,
) {
	return handleGitHubRepositoriesRoute(
		new Request(`http://localhost${pathname}`, init),
		pathname.split("?")[0] ?? pathname,
		"/workspace",
		deps,
	);
}

describe("GitHub OAuth routes", () => {
	it("reports GitHub connection states", async () => {
		const unconfigured = await route(
			"/api/github/connection",
			createRouteDeps({ env: {} }).deps,
		);
		expect(await unconfigured?.json()).toEqual(
			connection(false, false, null, "GitHub OAuth is not configured"),
		);

		const disconnected = await route(
			"/api/github/connection",
			createRouteDeps().deps,
		);
		expect(await disconnected?.json()).toEqual(
			connection(true, false, null, "Connect GitHub to list repositories"),
		);

		const connected = await route(
			"/api/github/connection",
			createRouteDeps({ initialStore: CONNECTED_STORE }).deps,
		);
		expect(await connected?.json()).toEqual(
			connection(true, true, "octo", null),
		);
	});

	it("redirects OAuth start requests to GitHub with a state cookie", async () => {
		const response = await route(
			"/api/github/oauth/start",
			createRouteDeps().deps,
		);
		const location = new URL(response?.headers.get("location") ?? "");

		expect(response?.status).toBe(302);
		expect(location.origin + location.pathname).toBe(
			"https://github.com/login/oauth/authorize",
		);
		expect(location.searchParams.get("client_id")).toBe("client-id");
		expect(location.searchParams.get("redirect_uri")).toBe(
			"http://localhost/api/github/oauth/callback",
		);
		expect(location.searchParams.get("scope")).toBe("repo");
		expect(location.searchParams.get("state")).toBe("state-123");
		expect(response?.headers.get("set-cookie")).toContain(
			"devos_github_oauth_state=state-123; HttpOnly; SameSite=Lax; Path=/api/github/oauth; Max-Age=600",
		);
	});

	it("exchanges OAuth callback codes, saves token/login, and redirects", async () => {
		const fetchFn = (async (input: URL | RequestInfo, init?: RequestInit) => {
			if (String(input) === "https://github.com/login/oauth/access_token") {
				expect(init?.method).toBe("POST");
				return Response.json({ access_token: "token-123" });
			}
			expect((init?.headers as Record<string, string>).authorization).toBe(
				"Bearer token-123",
			);
			return Response.json({ login: "octo" });
		}) as typeof fetch;
		const { deps, saves } = createRouteDeps({ fetchFn });

		const response = await route(
			"/api/github/oauth/callback?code=code-123&state=state-123",
			deps,
			{ headers: { cookie: "devos_github_oauth_state=state-123" } },
		);

		expect(response?.status).toBe(302);
		expect(response?.headers.get("location")).toBe(
			"http://localhost/projects?github=connected",
		);
		expect(response?.headers.get("set-cookie")).toContain("Max-Age=0");
		expect(saves).toEqual([
			{
				GITHUB_OAUTH_ACCESS_TOKEN: "token-123",
				GITHUB_OAUTH_LOGIN: "octo",
			},
		]);
	});

	it("rejects invalid callback state without saving", async () => {
		const { deps, saves } = createRouteDeps();
		const response = await route(
			"/api/github/oauth/callback?code=code-123&state=state-123",
			deps,
			{ headers: { cookie: "devos_github_oauth_state=wrong-state" } },
		);

		expect(response?.status).toBe(400);
		expect(await response?.json()).toEqual({
			error: "Invalid GitHub OAuth callback",
		});
		expect(saves).toEqual([]);
	});

	it("clears stored token and login on disconnect", async () => {
		const { deps, saves } = createRouteDeps({ initialStore: CONNECTED_STORE });
		const response = await route("/api/github/connection", deps, {
			method: "DELETE",
		});

		expect(await response?.json()).toEqual(
			connection(true, false, null, "Connect GitHub to list repositories"),
		);
		expect(saves).toEqual([
			{
				GITHUB_OAUTH_ACCESS_TOKEN: undefined,
				GITHUB_OAUTH_LOGIN: undefined,
			},
		]);
	});

	it("returns method not allowed for known OAuth paths", async () => {
		for (const pathname of [
			"/api/github/connection",
			"/api/github/oauth/start",
			"/api/github/oauth/callback",
		]) {
			const response = await route(pathname, createRouteDeps().deps, {
				method: "POST",
			});
			expect(response?.status).toBe(405);
		}
	});
});
