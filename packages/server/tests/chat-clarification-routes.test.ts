import { afterEach, describe, expect, it } from "bun:test";
import type { RealtimeEventPayload } from "../src/realtime";
import type { RouteHandler } from "../src/types/app.types";
import {
	createJsonRequest,
	createServerTestApp,
	waitForRealtimeEvent,
} from "./app-test-helpers";
import {
	type DrizzleServerTestDatabase,
	createDrizzleServerTestDatabase,
} from "./server-db-test-helpers";

let testDatabase: DrizzleServerTestDatabase | undefined;

afterEach(async () => {
	if (testDatabase) {
		await testDatabase.cleanup();
		testDatabase = undefined;
	}
});

describe("chat clarification routes", () => {
	it("renders only the current clarification question in assistant text", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const events: RealtimeEventPayload[] = [];
		const app = createServerTestApp(testDatabase.db, {
			cliExecutor: {
				execute: async (request) => ({
					status: "succeeded",
					request,
					commandResult: {
						code: 0,
						stdout:
							'{"status":"needs_info","questions":["Which agent?","What scope?"]}\n',
						stderr: "",
					},
				}),
				executeStream: async (request) => ({ status: "succeeded", request }),
				getHistory: () => [],
			},
			realtimeEvents: { publish: (event) => events.push(event) },
			workspacePath: testDatabase.path,
		});
		const created = await app(
			createJsonRequest("POST", "/api/chat/sessions", {}),
		);
		const session = (await created.json()) as { id: string };
		const unclear = await app(
			createJsonRequest("POST", `/api/chat/sessions/${session.id}/send`, {
				content: "Route agent choice",
			}),
		);
		expect(unclear.status).toBe(202);
		await waitForRealtimeEvent(events, "chat.session.updated");
		const body = await readChatState(app, session.id);

		expect(body.session.pendingQuestions).toEqual([
			{ question: "Which agent?" },
			{ question: "What scope?" },
		]);
		expect(body.messages[1]?.content).toContain("Which agent?");
		expect(body.messages[1]?.content).not.toContain("What scope?");
	});

	it("keeps unclear tasks in backlog and moves answered tasks to plan", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const cliCalls: unknown[] = [];
		const events: RealtimeEventPayload[] = [];
		let callCount = 0;
		const app = createServerTestApp(testDatabase.db, {
			cliExecutor: {
				execute: async (request) => {
					cliCalls.push(request);
					callCount += 1;
					return {
						status: "succeeded",
						request,
						commandResult: {
							code: 0,
							stdout: intakeOutput(callCount),
							stderr: "",
						},
					};
				},
				executeStream: async (request) => ({ status: "succeeded", request }),
				getHistory: () => [],
			},
			realtimeEvents: { publish: (event) => events.push(event) },
			workspacePath: testDatabase.path,
		});
		const created = await app(
			createJsonRequest("POST", "/api/chat/sessions", {}),
		);
		const session = (await created.json()) as { id: string; taskId: string };

		const unclear = await app(
			createJsonRequest("POST", `/api/chat/sessions/${session.id}/send`, {
				content: "Route agent choice",
			}),
		);
		expect(unclear.status).toBe(202);
		await waitForRealtimeEvent(events, "chat.session.updated");
		const unclearBody = await readChatState(app, session.id);

		expect(findIssueUpdate(events)).toMatchObject({
			id: session.taskId,
			status: "backlog",
			title: "Untitled chat",
		});
		expect(unclearBody.session.pendingRequest).toBe("Route agent choice");
		expect(unclearBody.session.pendingQuestions).toEqual([
			{
				question: "Which agent?",
				options: [
					{ label: "Codex", value: "codex", recommended: true },
					{ label: "Claude", value: "claude" },
				],
			},
		]);
		expect(unclearBody.messages[1]?.kind).toBe("clarification");

		events.length = 0;
		const answered = await app(
			createJsonRequest("POST", `/api/chat/sessions/${session.id}/send`, {
				content: "codex",
				answers: [{ question: "Which agent?", answer: "codex" }],
			}),
		);
		expect(answered.status).toBe(202);
		await waitForRealtimeEvent(events, "chat.session.updated");
		const answeredBody = await readChatState(app, session.id);

		expect(findIssueUpdate(events)).toMatchObject({
			id: session.taskId,
			title: "Route agent choice",
			content: "Use the selected agent.",
			status: "plan",
		});
		expect(answeredBody.session.pendingQuestions).toEqual([]);
		expect(answeredBody.session.pendingRequest).toBeNull();
		expect(cliCalls).toMatchObject([
			{ request: "Route agent choice", clarificationAnswers: [] },
			{
				request: "Route agent choice",
				clarificationAnswers: [{ question: "Which agent?", answer: "codex" }],
			},
		]);
	});
});

interface ChatRouteState {
	messages: Array<{ content: string; kind: string }>;
	session: {
		pendingQuestions: Array<{ question: string; options?: unknown[] }>;
		pendingRequest: string | null;
	};
}

async function readChatState(
	app: RouteHandler,
	sessionId: string,
): Promise<ChatRouteState> {
	const messagesResponse = await app(
		new Request(`http://localhost/api/chat/sessions/${sessionId}/messages`),
	);
	const sessionsResponse = await app(
		new Request("http://localhost/api/chat/sessions?workspaceId=owner-1"),
	);
	const messages =
		(await messagesResponse.json()) as ChatRouteState["messages"];
	const sessions =
		(await sessionsResponse.json()) as ChatRouteState["session"][];
	const session = sessions.find((item) => item.pendingRequest !== undefined);
	if (!session) {
		throw new Error("Expected chat session state");
	}
	return { messages, session };
}

function findIssueUpdate(
	events: RealtimeEventPayload[],
): { content?: string; id: string; status: string; title: string } | undefined {
	return (
		events.find((event) => event.type === "issue.updated") as
			| {
					issue: {
						content?: string;
						id: string;
						status: string;
						title: string;
					};
			  }
			| undefined
	)?.issue;
}

function intakeOutput(callCount: number): string {
	return callCount === 1
		? '{"status":"needs_info","questions":[{"question":"Which agent?","options":[{"label":"Codex","value":"codex","recommended":true},{"label":"Claude","value":"claude","recommended":false}]}]}\n'
		: '{"status":"ready","task":{"title":"Route agent choice","description":"Use the selected agent."}}\n';
}
