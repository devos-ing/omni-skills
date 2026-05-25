import { afterEach, describe, expect, it } from "bun:test";
import { WebSocket } from "ws";
import { runWorkflow } from "../../packages/cli/src/features/workflow/workflow";
import { createServerTestApp } from "../../packages/server/tests/app-test-helpers";
import {
	type ChatWorkflowPollTestSetup,
	cleanupChatWorkflowPollTest,
	createLoadedConfig,
	createWorkflowRuntime,
	requestJson,
	setupChatWorkflowPollTest,
	taskIntakeOutput,
} from "./chat-to-workflow-poll-e2e-harness";
import { canOpenLoopbackServer } from "./websocket-flow-e2e-harness";

let activeTest: ChatWorkflowPollTestSetup | undefined;

afterEach(async () => {
	const test = activeTest;
	activeTest = undefined;
	if (test) {
		await cleanupChatWorkflowPollTest(test);
	}
});

describe("chat to workflow poll e2e", () => {
	it("creates a plan task from chat clarification and lets CLI polling pick it up", async () => {
		if (!(await canOpenLoopbackServer())) {
			return;
		}
		const setup = await setupChatWorkflowPollTest(
			WebSocket as unknown as typeof globalThis.WebSocket,
		);
		activeTest = setup;
		const cliCalls: unknown[] = [];
		let intakeCalls = 0;
		const app = createServerTestApp(setup.database.db, {
			cliExecutor: {
				execute: async (request) => {
					cliCalls.push(request);
					intakeCalls += 1;
					return {
						status: "succeeded",
						request,
						commandResult: {
							code: 0,
							stdout: taskIntakeOutput(intakeCalls),
							stderr: "",
						},
					};
				},
				executeStream: async (request) => ({ status: "succeeded", request }),
				getHistory: () => [],
			},
			realtimeEvents: setup.realtimeEvents,
			workspacePath: setup.workspacePath,
		});
		const created = await requestJson<{ id: string; taskId: string }>(
			app,
			"POST",
			"/api/chat/sessions",
			{},
		);

		const unclear = await requestJson<{
			issue: { id: string; status: string; title: string };
			messages: Array<{ content: string; kind: string }>;
			session: { pendingRequest: string | null };
		}>(app, "POST", `/api/chat/sessions/${created.id}/send`, {
			content: "Submit ur idea for an agent handoff",
		});

		expect(unclear.issue).toMatchObject({
			id: created.taskId,
			status: "backlog",
			title: "Untitled chat",
		});
		expect(unclear.messages[1]).toMatchObject({ kind: "clarification" });
		expect(unclear.messages[1]?.content).toContain(
			"Which agent should own it?",
		);
		expect(unclear.session.pendingRequest).toBe(
			"Submit ur idea for an agent handoff",
		);

		const answered = await requestJson<{
			issue: { content: string; id: string; status: string };
			session: { pendingRequest: string | null };
		}>(app, "POST", `/api/chat/sessions/${created.id}/send`, {
			content: "codex",
			answers: [{ question: "Which agent should own it?", answer: "codex" }],
		});

		expect(answered.issue).toMatchObject({
			id: created.taskId,
			content: "Create an agent handoff from chat.",
			status: "plan",
		});
		expect(answered.session.pendingRequest).toBeNull();

		await runWorkflow(
			createLoadedConfig(setup.workspacePath, setup.database.path),
			{ poll: true, maxPollCycles: 1 },
			createWorkflowRuntime(),
		);

		const finalTask = await requestJson<{ status: string }>(
			app,
			"GET",
			`/api/tasks/${created.taskId}`,
		);
		expect(finalTask.status).toBe("reviewing");
		await expectTaskActivity(app, created.taskId);
		await expectPollingStatus(app);
		expect(setup.events.map((event) => event.type)).toContain("polling.event");
		expect(cliCalls).toMatchObject([
			{ request: "Submit ur idea for an agent handoff" },
			{
				request: "Submit ur idea for an agent handoff",
				clarificationAnswers: [
					{ question: "Which agent should own it?", answer: "codex" },
				],
			},
		]);
	});
});

async function expectTaskActivity(
	app: (request: Request) => Response | Promise<Response>,
	taskId: string,
): Promise<void> {
	const activity = await requestJson<unknown>(
		app,
		"GET",
		`/api/tasks/${taskId}/activity`,
	);
	const activityText = JSON.stringify(activity);
	expect(activityText).toContain("devos.ing started planning.");
	expect(activityText).toContain("Implementation completed");
	expect(activityText).toContain("Review/testing passed");
}

async function expectPollingStatus(
	app: (request: Request) => Response | Promise<Response>,
): Promise<void> {
	const pollingStatus = await requestJson<{
		events: Array<{ eventType: string }>;
		pollers: Array<{ id: string; lastReadyTaskCount: number }>;
	}>(app, "GET", "/api/polling/status");
	expect(pollingStatus.pollers).toContainEqual(
		expect.objectContaining({
			id: "linear:default",
			lastReadyTaskCount: 1,
		}),
	);
	expect(pollingStatus.events.map((event) => event.eventType)).toContain(
		"cycle_completed",
	);
}
