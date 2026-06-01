import { describe, expect, it } from "bun:test";
import { searchGitHubRepositories } from "../src/github";

function jsonResponse(payload: unknown, status = 200): Response {
	return new Response(JSON.stringify(payload), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function fetchStub(
	handler: (input: URL | RequestInfo, init?: RequestInit) => Promise<Response>,
): typeof fetch {
	return handler as unknown as typeof fetch;
}

describe("GitHub repository search service", () => {
	it("maps GitHub repository search results into stable records", async () => {
		const fetchFn = fetchStub(async (input, init) => {
			expect(String(input)).toBe(
				"https://api.github.com/search/repositories?q=show-me-ur-agents&per_page=8",
			);
			expect(init?.headers).toBeInstanceOf(Headers);
			expect((init?.headers as Headers).get("accept")).toBe(
				"application/vnd.github+json",
			);
			return jsonResponse({
				items: [
					{
						owner: { login: "devos" },
						name: "missing-id",
						full_name: "devos/missing-id",
						html_url: "https://github.com/devos/missing-id",
						clone_url: "https://github.com/devos/missing-id.git",
						default_branch: "main",
						description: "Malformed record",
						private: false,
					},
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
					{
						id: "8",
						owner: { login: "devos" },
						name: "string-id",
						full_name: "devos/string-id",
						html_url: "https://github.com/devos/string-id",
						clone_url: "https://github.com/devos/string-id.git",
						default_branch: "main",
						description: null,
						private: true,
					},
				],
			});
		});

		const result = await searchGitHubRepositories({
			query: " show-me-ur-agents ",
			fetchFn,
		});

		expect(result).toEqual({
			status: "ok",
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
				{
					id: "8",
					owner: "devos",
					name: "string-id",
					fullName: "devos/string-id",
					htmlUrl: "https://github.com/devos/string-id",
					cloneUrl: "https://github.com/devos/string-id.git",
					defaultBranch: "main",
					description: null,
					isPrivate: true,
				},
			],
		});
	});

	it("returns stable statuses for validation, auth, rate limit, and upstream failures", async () => {
		expect(await searchGitHubRepositories({ query: " " })).toEqual({
			status: "invalid_query",
		});

		const unauthorizedFetch = fetchStub(async () =>
			jsonResponse({ message: "Bad credentials" }, 401),
		);
		expect(
			await searchGitHubRepositories({
				query: "repo",
				fetchFn: unauthorizedFetch,
			}),
		).toEqual({ status: "auth_unavailable" });

		const rateLimitedFetch = fetchStub(async () =>
			jsonResponse({ message: "rate limited" }, 403),
		);
		expect(
			await searchGitHubRepositories({
				query: "repo",
				fetchFn: rateLimitedFetch,
			}),
		).toEqual({ status: "rate_limited" });

		const failingFetch = fetchStub(async () => {
			throw new Error("network down");
		});
		expect(
			await searchGitHubRepositories({
				query: "repo",
				fetchFn: failingFetch,
			}),
		).toEqual({ status: "upstream_error" });
	});
});
