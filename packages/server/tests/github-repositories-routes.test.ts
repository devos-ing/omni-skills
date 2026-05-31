import { describe, expect, it } from "bun:test";
import { handleGitHubRepositoriesRoute } from "../src/http/github-repositories-routes";
import type { GitHubRepositoriesRouteDeps } from "../src/http/types/github-repositories-api.types";

type FetchCall = { input: URL | RequestInfo; init?: RequestInit };

const CONNECTED_STORE = {
	GITHUB_OAUTH_ACCESS_TOKEN: "token-123",
	GITHUB_OAUTH_LOGIN: "octo",
};

function unavailable(unavailableReason: string) {
	return { isAvailable: false, unavailableReason, repositories: [] };
}

function createRouteDeps(options?: {
	env?: Record<string, string>;
	initialStore?: Record<string, string>;
	fetchFn?: typeof fetch;
}) {
	const store = { ...(options?.initialStore ?? {}) };
	const fetchCalls: FetchCall[] = [];
	const fetchFn = (async (input, init) => {
		fetchCalls.push({ input, init });
		return (
			options?.fetchFn?.(input, init) ?? new Response("{}", { status: 500 })
		);
	}) as typeof fetch;
	const deps: GitHubRepositoriesRouteDeps = {
		env: options?.env ?? {
			GITHUB_OAUTH_CLIENT_ID: "client-id",
			GITHUB_OAUTH_CLIENT_SECRET: "client-secret",
		},
		fetchFn,
		loadEnv: async () => ({ ...store }),
	};
	return { deps, fetchCalls };
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

describe("GitHub repositories route", () => {
	it("lists repositories from GitHub REST with a stored connection", async () => {
		const { deps, fetchCalls } = createRouteDeps({
			initialStore: CONNECTED_STORE,
			fetchFn: (async () =>
				Response.json([
					{
						id: 42,
						name: "core",
						full_name: "octo/core",
						default_branch: "trunk",
						private: true,
						owner: { login: "octo" },
					},
				])) as unknown as typeof fetch,
		});

		const response = await route("/api/github/repositories", deps);

		expect(String(fetchCalls[0]?.input)).toBe(
			"https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member",
		);
		expect(await response?.json()).toEqual({
			isAvailable: true,
			unavailableReason: null,
			repositories: [
				{
					id: "42",
					owner: "octo",
					name: "core",
					nameWithOwner: "octo/core",
					defaultBranch: "trunk",
					isPrivate: true,
				},
			],
		});
	});

	it("does not call GitHub when a stored login is missing", async () => {
		const { deps, fetchCalls } = createRouteDeps({
			initialStore: { GITHUB_OAUTH_ACCESS_TOKEN: "token-123" },
		});

		const response = await route("/api/github/repositories", deps);

		expect(await response?.json()).toEqual(
			unavailable("Connect GitHub to list repositories"),
		);
		expect(fetchCalls).toEqual([]);
	});

	it("returns unavailable repository responses for disconnected or bad REST states", async () => {
		const cases = [
			{
				deps: createRouteDeps({ env: {} }).deps,
				reason: "GitHub OAuth is not configured",
			},
			{
				deps: createRouteDeps().deps,
				reason: "Connect GitHub to list repositories",
			},
			{
				deps: createRouteDeps({
					initialStore: CONNECTED_STORE,
					fetchFn: (async () =>
						new Response("nope", { status: 500 })) as unknown as typeof fetch,
				}).deps,
				reason: "GitHub repositories unavailable",
			},
			{
				deps: createRouteDeps({
					initialStore: CONNECTED_STORE,
					fetchFn: (async () =>
						Response.json({ bad: true })) as unknown as typeof fetch,
				}).deps,
				reason: "GitHub repositories unavailable",
			},
		];

		for (const item of cases) {
			const response = await route("/api/github/repositories", item.deps);
			expect(await response?.json()).toEqual(unavailable(item.reason));
		}
	});

	it("returns method not allowed or null for non-repository routes", async () => {
		const response = await route(
			"/api/github/repositories",
			createRouteDeps().deps,
			{
				method: "POST",
			},
		);
		expect(response?.status).toBe(405);
		expect(
			await route("/api/github/not-here", createRouteDeps().deps),
		).toBeNull();
	});
});
