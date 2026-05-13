import { describe, expect, it } from "bun:test";
import { createApiClient } from "../../web/src/lib/api/client";

describe("web api client task create", () => {
	it("serializes clarification answers in dispatch payload", async () => {
		const calls: Array<{ url: string; body: unknown }> = [];
		const fetchFn = (async (input: URL | RequestInfo, init?: RequestInit) => {
			calls.push({
				url: String(input),
				body: init?.body ? JSON.parse(String(init.body)) : undefined,
			});
			return new Response(
				JSON.stringify({
					status: "succeeded",
					commandResult: {
						stdout: "Created Linear task ROY-1: https://linear.example/ROY-1",
					},
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}) as typeof fetch;
		const client = createApiClient({
			baseUrl: "http://localhost:3000",
			fetchFn,
		});

		await client.createTask({
			request: "Create a task",
			projectId: "default",
			answers: [{ question: "Who is this for?", answer: "CLI users" }],
		});

		expect(calls).toEqual([
			{
				url: "http://localhost:3000/api/cli/dispatch",
				body: {
					action: "task",
					taskAction: "create",
					request: "Create a task",
					projectId: "default",
					answers: [{ question: "Who is this for?", answer: "CLI users" }],
				},
			},
		]);
	});
});
