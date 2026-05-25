import { mkdtemp, rm } from "node:fs/promises";
import { type Server, createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import type { AgentAdapter, AgentResult } from "adapters";
import type { LoadedConfig } from "../../packages/cli/src/features/config/types/config.types";
import type { ResolvedProjectConfig } from "../../packages/cli/src/features/types";
import { createBoardTaskWorkflowClient } from "../../packages/cli/src/features/workflow/board-task-workflow-client";
import type { WorkflowRuntime } from "../../packages/cli/src/features/workflow/types/workflow.types";
import { createRealtimeEventBus } from "../../packages/server/src/realtime";
import { WORKFLOW_DATA_WS_PATH } from "../../packages/server/src/workflow-data";
import { createWorkflowCommandBroker } from "../../packages/server/src/workflow-data/workflow-command-broker";
import { attachWorkflowDataSocket } from "../../packages/server/src/workflow-data/workflow-data-socket";
import { createJsonRequest } from "../../packages/server/tests/app-test-helpers";
import {
	type DrizzleServerTestDatabase,
	createDrizzleServerTestDatabase,
} from "../../packages/server/tests/server-db-test-helpers";

export interface ChatWorkflowPollTestSetup {
	close(): Promise<void>;
	database: DrizzleServerTestDatabase;
	events: Array<{ type: string }>;
	previousWebSocket: typeof globalThis.WebSocket;
	previousWorkflowUrl: string | undefined;
	realtimeEvents: ReturnType<typeof createRealtimeEventBus>;
	workspacePath: string;
}

export async function setupChatWorkflowPollTest(
	WebSocketImpl: typeof globalThis.WebSocket,
): Promise<ChatWorkflowPollTestSetup> {
	const database = await createDrizzleServerTestDatabase();
	const workspacePath = await mkdtemp(
		path.join(os.tmpdir(), "devos-chat-e2e-"),
	);
	const realtimeEvents = createRealtimeEventBus();
	const events: Array<{ type: string }> = [];
	realtimeEvents.subscribe((event) => events.push(event));
	const httpServer = createServer((_request, response) => {
		response.statusCode = 404;
		response.end();
	});
	const workflowProxy = attachWorkflowDataSocket({
		server: httpServer,
		path: WORKFLOW_DATA_WS_PATH,
		db: database.db,
		commandBroker: createWorkflowCommandBroker(),
		realtimeEvents,
	});
	const port = await listenOnPortZero(httpServer);
	const previousWorkflowUrl = process.env.DEVOS_WORKFLOW_WS_URL;
	process.env.DEVOS_WORKFLOW_WS_URL = `ws://127.0.0.1:${port}${WORKFLOW_DATA_WS_PATH}`;
	const previousWebSocket = globalThis.WebSocket;
	globalThis.WebSocket = WebSocketImpl;
	return {
		database,
		events,
		previousWebSocket,
		previousWorkflowUrl,
		realtimeEvents,
		workspacePath,
		close: async () => {
			await Promise.allSettled([
				workflowProxy.close(),
				closeHttpServer(httpServer),
			]);
		},
	};
}

export async function cleanupChatWorkflowPollTest(
	test: ChatWorkflowPollTestSetup,
): Promise<void> {
	globalThis.WebSocket = test.previousWebSocket;
	restoreEnv("DEVOS_WORKFLOW_WS_URL", test.previousWorkflowUrl);
	await test.close();
	await test.database.cleanup();
	await rm(test.workspacePath, { recursive: true, force: true });
}

export function createLoadedConfig(
	workspacePath: string,
	databasePath: string,
): LoadedConfig {
	const project = createProject(workspacePath, databasePath);
	return {
		projects: [project],
		server: project.server,
		polling: {
			intervalMs: 1,
			maxCycles: 1,
			exitWhenIdle: true,
			staleRunTimeoutMs: 1000,
		},
		notifications: { email: { enabled: false, to: [] } },
		workspace: { id: "owner-1", name: "Default Workspace" },
	};
}

export function createWorkflowRuntime(): WorkflowRuntime {
	return {
		createLinearClient: createBoardTaskWorkflowClient,
		createAgentAdapter: () => createPassingAgent(),
		ensureBaseBranchFresh: async () => {},
		ensureIssueWorktree: async (_config, _key, _pr, worktreePath) =>
			worktreePath,
		prepareWorktreeDependencies: async () => {},
		removeIssueWorktree: async () => ({ removed: true }),
		findOpenPullRequestForIssue: async () => undefined,
		getPullRequestMergeStatus: async () => ({}),
		prepareImplementationBranch: async (_config, issueKey) =>
			`codex/${issueKey.toLowerCase()}`,
		createDraftPrFromWorktree: async (_config, issueKey, title) => ({
			branch: `codex/${issueKey.toLowerCase()}`,
			title,
			url: "https://example.invalid/dry-run",
		}),
		updateDraftPrFromWorktree: async () => true,
		commentOnPr: async () => {},
		markPrReadyForReview: async () => true,
		squashMergePullRequest: async () => true,
		sendTaskOutcomeEmail: async () => {},
		sendHumanReviewRequiredEmail: async () => {},
	};
}

export function taskIntakeOutput(callCount: number): string {
	return callCount === 1
		? '{"status":"needs_info","questions":["Which agent should own it?"]}\n'
		: '{"status":"ready","task":{"title":"Agent handoff from chat","description":"Create an agent handoff from chat."}}\n';
}

export async function requestJson<T>(
	app: (request: Request) => Response | Promise<Response>,
	method: string,
	pathname: string,
	body?: unknown,
): Promise<T> {
	const response = await app(
		method === "GET"
			? new Request(`http://localhost${pathname}`)
			: createJsonRequest(method, pathname, body),
	);
	if (!response.ok) {
		throw new Error(`${method} ${pathname} failed with ${response.status}`);
	}
	return (await response.json()) as T;
}

function createProject(
	workspacePath: string,
	databasePath: string,
): ResolvedProjectConfig {
	const repoRoot = process.cwd();
	return {
		id: "default",
		name: "Default Project",
		workspacePath,
		executionPath: workspacePath,
		repo: { owner: "acme", name: "repo", baseBranch: "main" },
		linear: {
			apiKey: "fake",
			apiUrl: "https://linear.example/graphql",
			projectId: undefined,
			pollLimit: 20,
			statusMap: {
				backlog: "backlog",
				assigned: "plan",
				planning: "planning",
				implementing: "implementing",
				pr_created: "pr_created",
				reviewing: "reviewing",
				testing: "testing",
				blocked: "blocked",
				done: "done",
			},
			labelMap: {},
			autoCreateLabels: false,
		},
		github: { useGhCli: false, defaultBugLabel: "bug" },
		server: { database: { databasePath, port: 54329 } },
		codex: { binary: "codex", streamLogs: false },
		skills: {
			root: path.join(repoRoot, "skills"),
			plan: path.join(repoRoot, "skills/piv-plan/SKILL.md"),
			implement: path.join(repoRoot, "skills/piv-implement/SKILL.md"),
			reviewTest: path.join(repoRoot, "skills/piv-review-test/SKILL.md"),
			githubComment: path.join(repoRoot, "skills/piv-github-comment/SKILL.md"),
		},
		workflow: { issueConcurrency: 1 },
		dryRun: true,
	};
}

function createPassingAgent(): AgentAdapter {
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
		runPlan: async () => result(plan, "plan-session"),
		runTaskIntake: async () => result(""),
		resume: async () => result("Implemented chat handoff.", "plan-session"),
		runReview: async () =>
			result("RESULT: PASS\nSUMMARY: clean\nBUGS_JSON: []", "review-session"),
		runGithubComment: async () => result(""),
	};
}

function listenOnPortZero(server: Server): Promise<number> {
	return new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (!address || typeof address === "string") {
				reject(new Error("Unable to resolve e2e websocket port"));
				return;
			}
			resolve(address.port);
		});
	});
}

function closeHttpServer(server: Server): Promise<void> {
	if (!server.listening) {
		return Promise.resolve();
	}
	return new Promise((resolve, reject) => {
		server.close((error) => (error ? reject(error) : resolve()));
	});
}

function restoreEnv(name: string, value: string | undefined): void {
	if (value === undefined) {
		delete process.env[name];
		return;
	}
	process.env[name] = value;
}
