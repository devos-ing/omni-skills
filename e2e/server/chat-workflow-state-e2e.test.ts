import { afterEach, describe, expect, it } from "bun:test";
import type { AgentAdapter, AgentResult } from "adapters";
import { WebSocket } from "ws";
import { loadRunState } from "../../packages/cli/src/features/workflow/state";
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

describe("chat workflow state e2e", () => {
	it("persists failed workflow state when implementation fails", async () => {
		if (!(await canOpenLoopbackServer())) {
			return;
		}
		const setup = await setupChatWorkflowPollTest(
			WebSocket as unknown as typeof globalThis.WebSocket,
		);
		activeTest = setup;
		const app = createServerTestApp(setup.database.db, {
			cliExecutor: createTaskIntakeExecutor(),
			realtimeEvents: setup.realtimeEvents,
			workspacePath: setup.workspacePath,
		});
		const taskId = await createReadyTask(app);

		await runWorkflow(
			createLoadedConfig(setup.workspacePath, setup.database.path),
			{ poll: true, maxPollCycles: 1 },
			createImplementationFailureRuntime(),
		);

		const finalTask = await requestJson<{ status: string; taskKey: string }>(
			app,
			"GET",
			`/api/tasks/${taskId}`,
		);
		expect(finalTask.status).toBe("failed");
		const runState = await loadRunState(
			setup.workspacePath,
			"default",
			finalTask.taskKey,
		);
		expect(runState).toMatchObject({
			failedStage: "in_progress",
			lastError: "Implementation exploded",
			stage: "failed",
		});
		const activity = await requestJson<unknown>(
			app,
			"GET",
			`/api/tasks/${taskId}/activity`,
		);
		expect(JSON.stringify(activity)).toContain(
			"devos.ing failed and moved issue to Failed.",
		);
	});
});

function createTaskIntakeExecutor() {
	let intakeCalls = 0;
	return {
		execute: async (request: unknown) => {
			intakeCalls += 1;
			return {
				status: "succeeded" as const,
				request,
				commandResult: {
					code: 0,
					stdout: taskIntakeOutput(intakeCalls),
					stderr: "",
				},
			};
		},
		executeStream: async (request: unknown) => ({
			status: "succeeded" as const,
			request,
		}),
		getHistory: () => [],
	};
}

async function createReadyTask(
	app: (request: Request) => Response | Promise<Response>,
): Promise<string> {
	const created = await requestJson<{ id: string; taskId: string }>(
		app,
		"POST",
		"/api/chat/sessions",
		{},
	);
	await requestJson(app, "POST", `/api/chat/sessions/${created.id}/send`, {
		content: "Submit ur idea for an agent handoff",
	});
	await requestJson(app, "POST", `/api/chat/sessions/${created.id}/send`, {
		content: "codex",
		answers: [{ question: "Which agent should own it?", answer: "codex" }],
	});
	return created.taskId;
}

function createImplementationFailureRuntime(): ReturnType<
	typeof createWorkflowRuntime
> {
	const runtime = createWorkflowRuntime();
	return {
		...runtime,
		createAgentAdapter: () => createImplementationFailureAgent(),
	};
}

function createImplementationFailureAgent(): AgentAdapter {
	const plan = [
		"PLANNING_RESULT: READY",
		"SUCCESS_GOAL: Create an agent handoff from chat.",
		"COMPLEXITY: SIMPLE",
		"COMPLEXITY_SCORE: 3",
		"Use the existing chat-to-workflow path.",
	].join("\n");
	const result = (finalMessage: string, sessionId?: string): AgentResult => ({
		finalMessage,
		stdout: "",
		sessionId,
	});
	return {
		runAgent: async (request) => {
			if (request.role === "brainstorm") {
				return result(
					"BRAINSTORM_RESULT: READY\nSUMMARY: Smallest coherent scope.",
					"brainstorm-session",
				);
			}
			if (request.role === "planning") return result(plan, "plan-session");
			if (request.role === "implementing") {
				throw new Error("Implementation exploded");
			}
			return result("");
		},
		runPlan: async () => result(plan, "plan-session"),
		runTaskIntake: async () => result(""),
		resume: async () => {
			throw new Error("Implementation exploded");
		},
		runReview: async () =>
			result("RESULT: PASS\nSUMMARY: clean\nBUGS_JSON: []", "review-session"),
		runGithubComment: async () => result(""),
	};
}
