import { describe, expect, it } from "bun:test";
import { createHandleRequest } from "../src/app";

function jsonResponse(payload: unknown, status = 200): Response {
	return new Response(JSON.stringify(payload), {
		status,
		headers: { "content-type": "application/json" },
	});
}

describe("GitHub repository search route", () => {
	it("returns normalized repository search results", async () => {
		const app = createHandleRequest(createDeps());

		const response = await app(
			new Request(
				"http://localhost/api/github/repositories/search?q=show-me-ur-agents",
			),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			repositories: [
				{
					id: "7",
					owner: "devos",
					name: "show-me-ur-agents",
					fullName: "devos/show-me-ur-agents",
					htmlUrl: "https://github.com/devos/show-me-ur-agents",
					cloneUrl: "https://github.com/devos/show-me-ur-agents.git",
					defaultBranch: "main",
					description: "Agent workflow UI",
					isPrivate: false,
				},
			],
		});
	});

	it("maps validation, auth, rate-limit, upstream, and method errors", async () => {
		const app = createHandleRequest(createDeps());

		const invalid = await app(
			new Request("http://localhost/api/github/repositories/search?q=%20"),
		);
		expect(invalid.status).toBe(400);
		expect(await invalid.json()).toEqual({
			error: "Repository query is required",
		});

		const auth = await app(
			new Request("http://localhost/api/github/repositories/search?q=auth"),
		);
		expect(auth.status).toBe(503);
		expect(await auth.json()).toEqual({
			error: "GitHub repository search is not authenticated",
		});

		const limited = await app(
			new Request("http://localhost/api/github/repositories/search?q=limit"),
		);
		expect(limited.status).toBe(429);
		expect(await limited.json()).toEqual({
			error: "GitHub repository search is rate limited",
		});

		const upstream = await app(
			new Request("http://localhost/api/github/repositories/search?q=upstream"),
		);
		expect(upstream.status).toBe(502);
		expect(await upstream.json()).toEqual({
			error: "GitHub repository search is unavailable",
		});

		const post = await app(
			new Request("http://localhost/api/github/repositories/search?q=repo", {
				method: "POST",
			}),
		);
		expect(post.status).toBe(405);
	});
});

function createDeps() {
	const fetchFn = (async (input: URL | RequestInfo) => {
		const url = new URL(String(input));
		const query = url.searchParams.get("q");
		if (query === "auth")
			return jsonResponse({ message: "Bad credentials" }, 401);
		if (query === "limit") return jsonResponse({ message: "limited" }, 429);
		if (query === "upstream") return jsonResponse({ message: "down" }, 500);
		return jsonResponse({
			items: [
				{
					id: 7,
					owner: { login: "devos" },
					name: "show-me-ur-agents",
					full_name: "devos/show-me-ur-agents",
					html_url: "https://github.com/devos/show-me-ur-agents",
					clone_url: "https://github.com/devos/show-me-ur-agents.git",
					default_branch: "main",
					description: "Agent workflow UI",
					private: false,
				},
			],
		});
	}) as typeof fetch;

	return {
		githubRepositorySearchFetch: fetchFn,
		cliExecutor: {
			execute: async () => ({
				status: "succeeded" as const,
				request: { action: "none" as const },
			}),
			executeStream: async () => ({
				status: "succeeded" as const,
				request: { action: "none" as const },
			}),
			getHistory: () => [],
		},
	};
}
