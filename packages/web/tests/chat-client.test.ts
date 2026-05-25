import { describe, expect, it } from "bun:test";
import { createApiClient } from "../src/lib/api/client";

function okJsonResponse(payload: unknown): Response {
	return new Response(JSON.stringify(payload), {
		status: 200,
		headers: { "content-type": "application/json" },
	});
}

describe("chat API client", () => {
	it("parses chat sessions with linked issue ids", async () => {
		const fetchFn = (async (input: URL | RequestInfo, init?: RequestInit) => {
			expect(String(input)).toBe("/api/chat/sessions");
			expect(init?.method).toBe("POST");
			expect(JSON.parse(String(init?.body))).toEqual({
				workspaceId: "owner-1",
			});
			return okJsonResponse({
				id: "session-1",
				workspaceId: "owner-1",
				projectId: "default",
				taskId: "task-1",
				title: "Untitled",
				pendingRequest: null,
				pendingQuestions: [],
				createdAt: "2026-05-20T00:00:00.000Z",
				updatedAt: "2026-05-20T00:00:00.000Z",
			});
		}) as typeof fetch;
		const client = createApiClient({ fetchFn });

		const session = await client.createChatSession({ workspaceId: "owner-1" });

		expect(session.taskId).toBe("task-1");
		expect(session.projectId).toBe("default");
	});

	it("parses chat send responses with the linked issue", async () => {
		const fetchFn = (async (input: URL | RequestInfo, init?: RequestInit) => {
			expect(String(input)).toBe("/api/chat/sessions/session-1/send");
			expect(init?.method).toBe("POST");
			expect(JSON.parse(String(init?.body))).toEqual({
				content: "Build the dashboard",
			});
			return okJsonResponse({
				session: {
					id: "session-1",
					workspaceId: "owner-1",
					projectId: "default",
					taskId: "task-1",
					title: "Build the dashboard",
					pendingRequest: null,
					pendingQuestions: [],
					createdAt: "2026-05-20T00:00:00.000Z",
					updatedAt: "2026-05-20T00:01:00.000Z",
				},
				messages: [
					{
						id: "message-1",
						sessionId: "session-1",
						role: "user",
						kind: "message",
						content: "Build the dashboard",
						taskId: "task-1",
						commandAction: null,
						metadata: null,
						createdAt: "2026-05-20T00:01:00.000Z",
					},
				],
				issue: {
					id: "task-1",
					taskKey: "TASK(owner-1)-1",
					projectId: "default",
					title: "Build the dashboard",
					content: "Build the dashboard",
					priority: 0,
					status: "planning",
					dueDate: null,
					creatorId: "owner-1",
					assigneeId: null,
					linkedPr: null,
					linearIssueId: null,
					linearIdentifier: null,
					linearUrl: null,
					createdAt: "2026-05-20T00:00:00.000Z",
					updatedAt: "2026-05-20T00:01:00.000Z",
				},
			});
		}) as typeof fetch;
		const client = createApiClient({ fetchFn });

		const response = await client.sendChatMessage("session-1", {
			content: "Build the dashboard",
		});

		expect(response.issue.id).toBe("task-1");
		expect(response.messages[0]?.taskId).toBe("task-1");
		expect(response.session.taskId).toBe("task-1");
	});
});
