import { describe, expect, it } from "bun:test";
import { createApiClient } from "../src/lib/api/client";
import { parseCurrentWorkspaceRecord } from "../src/lib/api/workspace-client";

function okJsonResponse(payload: unknown): Response {
	return new Response(JSON.stringify(payload), {
		status: 200,
		headers: { "content-type": "application/json" },
	});
}

describe("workspace API client", () => {
	it("fetches the current workspace identity", async () => {
		const fetchFn = (async (input: URL | RequestInfo, init?: RequestInit) => {
			expect(String(input)).toBe("/api/workspace/current");
			expect(init?.method).toBe("GET");
			return okJsonResponse({
				workspaceId: "workspace-abcdef1234567890",
				name: "Roy Lab",
			});
		}) as typeof fetch;
		const client = createApiClient({ fetchFn });

		await expect(client.getCurrentWorkspace()).resolves.toEqual({
			workspaceId: "workspace-abcdef1234567890",
			name: "Roy Lab",
		});
	});

	it("validates current workspace payloads", () => {
		expect(() =>
			parseCurrentWorkspaceRecord({ workspaceId: "workspace-1" }),
		).toThrow("Invalid /api/workspace/current response field 'name'");
	});
});
