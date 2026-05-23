import { describe, expect, it } from "bun:test";
import {
	buildDaemonCommands,
	runProductionDaemon,
} from "../src/features/daemon";
import {
	createDaemonHarness,
	flushAsyncWork,
	readyImmediately,
} from "./daemon-test-harness";

describe("buildDaemonCommands", () => {
	it("builds production server, web, and workflow poller commands", () => {
		const commands = buildDaemonCommands({});

		expect(commands).toEqual([
			{
				name: "server",
				command: "bun",
				args: ["run", "--filter", "devos-server", "start"],
				env: { NODE_ENV: "production", PIV_SERVER_PORT: "3001" },
			},
			{
				name: "web",
				command: "bun",
				args: ["run", "--filter", "web", "start"],
				env: {
					NODE_ENV: "production",
					PORT: "3000",
					DEVOS_SERVER_BASE_URL: "http://127.0.0.1:3001",
					NEXT_PUBLIC_DEVOS_WORKFLOW_WS_URL: "ws://127.0.0.1:3001/api/workflow",
				},
			},
			{
				name: "workflow-poller",
				command: "bun",
				args: [
					"run",
					"packages/cli/src/index.ts",
					"run",
					"--all-projects",
					"--poll-forever",
				],
				env: {
					DEVOS_SERVER_BASE_URL: "http://127.0.0.1:3001",
					DEVOS_WORKFLOW_WS_URL: "ws://127.0.0.1:3001/api/workflow",
					NODE_ENV: "production",
				},
			},
		]);
	});

	it("preserves configured ports, base URL, and workflow websocket URL", () => {
		const commands = buildDaemonCommands({
			NODE_ENV: "development",
			PIV_SERVER_PORT: "4101",
			PORT: "4102",
			DEVOS_SERVER_BASE_URL: "https://api.example.test",
			DEVOS_WORKFLOW_WS_URL: "ws://workflow.example.test/socket",
		});

		expect(commands[0]?.env).toMatchObject({
			NODE_ENV: "production",
			PIV_SERVER_PORT: "4101",
		});
		expect(commands[1]?.env).toMatchObject({
			NODE_ENV: "production",
			PORT: "4102",
			DEVOS_SERVER_BASE_URL: "https://api.example.test",
			NEXT_PUBLIC_DEVOS_WORKFLOW_WS_URL: "ws://workflow.example.test/socket",
		});
		expect(commands[2]?.env).toMatchObject({
			DEVOS_SERVER_BASE_URL: "https://api.example.test",
			DEVOS_WORKFLOW_WS_URL: "ws://workflow.example.test/socket",
			NODE_ENV: "production",
		});
	});
});

describe("runProductionDaemon", () => {
	it("starts services and the outbound workflow worker in the requested cwd", async () => {
		const harness = createDaemonHarness();

		const done = runProductionDaemon({
			cwd: "/repo",
			env: {},
			spawnChild: harness.spawnChild,
			signalTarget: harness.signalTarget,
			startWorkflowWorker: harness.startWorkflowWorker,
			waitForServerReady: readyImmediately,
			waitForWebReady: readyImmediately,
		});
		await flushAsyncWork();
		expect(harness.calls).toEqual([
			{
				command: "bun",
				args: ["run", "--filter", "devos-server", "start"],
				cwd: "/repo",
			},
			{
				command: "bun",
				args: ["run", "--filter", "web", "start"],
				cwd: "/repo",
			},
			{
				command: "bun",
				args: [
					"run",
					"packages/cli/src/index.ts",
					"run",
					"--all-projects",
					"--poll-forever",
				],
				cwd: "/repo",
			},
		]);
		expect(harness.workflowWorkerEnv).toMatchObject({
			DEVOS_SERVER_BASE_URL: "http://127.0.0.1:3001",
			DEVOS_WORKFLOW_WS_URL: "ws://127.0.0.1:3001/api/workflow",
			PIV_WORKSPACE_PATH: "/repo",
		});
		harness.children[0]?.emit("close", 0, null);
		await expect(done).resolves.toBe(0);
		expect(harness.workflowWorkerStopped).toBe(true);
	});

	it("stops siblings and the worker when one service exits", async () => {
		const harness = createDaemonHarness();
		const done = runProductionDaemon({
			cwd: "/repo",
			env: {},
			cleanupPorts: async () => {},
			spawnChild: harness.spawnChild,
			signalTarget: harness.signalTarget,
			startWorkflowWorker: harness.startWorkflowWorker,
			waitForServerReady: readyImmediately,
			waitForWebReady: readyImmediately,
		});

		await flushAsyncWork();
		harness.children[0]?.emit("close", 7, null);

		await expect(done).resolves.toBe(7);
		expect(harness.children[0]?.killed).toBe(false);
		expect(harness.children[1]?.signals).toEqual(["SIGTERM"]);
		expect(harness.children[2]?.signals).toEqual(["SIGTERM"]);
		expect(harness.workflowWorkerStopped).toBe(true);
	});

	it("stops all services with the received process signal", async () => {
		const harness = createDaemonHarness();
		const done = runProductionDaemon({
			cwd: "/repo",
			env: {},
			spawnChild: harness.spawnChild,
			signalTarget: harness.signalTarget,
			startWorkflowWorker: harness.startWorkflowWorker,
			waitForServerReady: readyImmediately,
			waitForWebReady: readyImmediately,
		});

		await flushAsyncWork();
		harness.signalTarget.emitSignal("SIGINT");

		await expect(done).resolves.toBe(0);
		expect(harness.children.map((child) => child.signals)).toEqual([
			["SIGINT"],
			["SIGINT"],
			["SIGINT"],
		]);
	});

	it("returns failure and stops siblings when a child spawn errors", async () => {
		const harness = createDaemonHarness();
		const done = runProductionDaemon({
			cwd: "/repo",
			env: {},
			cleanupPorts: async () => {},
			spawnChild: harness.spawnChild,
			signalTarget: harness.signalTarget,
			startWorkflowWorker: harness.startWorkflowWorker,
			waitForServerReady: readyImmediately,
			waitForWebReady: readyImmediately,
		});

		await flushAsyncWork();
		harness.children[0]?.emit("error", new Error("spawn EACCES"));

		await expect(done).resolves.toBe(1);
		expect(harness.children[1]?.signals).toEqual(["SIGTERM"]);
		expect(harness.workflowWorkerStopped).toBe(true);
	});
});
