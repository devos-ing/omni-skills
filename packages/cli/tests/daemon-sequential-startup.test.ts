import { describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import {
	type DaemonChild,
	type DaemonServiceReadinessProbe,
	type DaemonSignalTarget,
	type DaemonSpawn,
	runProductionDaemon,
} from "../src/features/daemon";

describe("runProductionDaemon sequential startup", () => {
	it("starts server, then web, then workflow poller after readiness", async () => {
		const harness = createSequentialHarness();
		const done = harness.start();

		expect(harness.calls.map((call) => call.name)).toEqual(["server"]);
		expect(harness.readinessUrls).toEqual(["http://127.0.0.1:3001/health"]);

		await harness.readyServer();
		expect(harness.calls.map((call) => call.name)).toEqual(["server", "web"]);
		expect(harness.readinessUrls).toEqual([
			"http://127.0.0.1:3001/health",
			"http://127.0.0.1:3000",
		]);

		await harness.readyWeb();
		expect(harness.calls.map((call) => call.name)).toEqual([
			"server",
			"web",
			"workflow-poller",
		]);

		harness.children[0]?.emit("close", 0, null);
		await expect(done).resolves.toBe(0);
	});

	it("does not start web or polling when server readiness fails", async () => {
		const harness = createSequentialHarness();
		const done = harness.start();

		await harness.failServer();

		await expect(done).resolves.toBe(1);
		expect(harness.calls.map((call) => call.name)).toEqual(["server"]);
		expect(harness.children[0]?.signals).toEqual(["SIGTERM"]);
		expect(harness.cleanupCalls).toEqual([
			{ serverPort: "3001", webPort: "3000" },
		]);
		expect(harness.workflowWorkerStopped).toBe(true);
	});

	it("does not start polling when web readiness fails", async () => {
		const harness = createSequentialHarness();
		const done = harness.start();

		await harness.readyServer();
		await harness.failWeb();

		await expect(done).resolves.toBe(1);
		expect(harness.calls.map((call) => call.name)).toEqual(["server", "web"]);
		expect(harness.children[0]?.signals).toEqual(["SIGTERM"]);
		expect(harness.children[1]?.signals).toEqual(["SIGTERM"]);
		expect(harness.workflowWorkerStopped).toBe(true);
	});
});

class FakeDaemonChild extends EventEmitter implements DaemonChild {
	killed = false;
	readonly signals: Array<NodeJS.Signals | undefined> = [];

	kill(signal?: NodeJS.Signals): boolean {
		this.killed = true;
		this.signals.push(signal);
		return true;
	}
}

class FakeSignalTarget implements DaemonSignalTarget {
	private readonly emitter = new EventEmitter();

	on(signal: NodeJS.Signals, listener: () => void): void {
		this.emitter.on(signal, listener);
	}

	off(signal: NodeJS.Signals, listener: () => void): void {
		this.emitter.off(signal, listener);
	}
}

function createSequentialHarness(): {
	calls: Array<{ name: string }>;
	children: FakeDaemonChild[];
	cleanupCalls: Array<{ serverPort: string; webPort: string }>;
	failServer(): Promise<void>;
	failWeb(): Promise<void>;
	readinessUrls: string[];
	readyServer(): Promise<void>;
	readyWeb(): Promise<void>;
	start(): Promise<number>;
	workflowWorkerStopped: boolean;
} {
	const serverReady = createDeferred<void>();
	const webReady = createDeferred<void>();
	const harness = {
		calls: [] as Array<{ name: string }>,
		children: [] as FakeDaemonChild[],
		cleanupCalls: [] as Array<{ serverPort: string; webPort: string }>,
		readinessUrls: [] as string[],
		signalTarget: new FakeSignalTarget(),
		workflowWorkerStopped: false,
		failServer: async () => {
			serverReady.reject(new Error("server not ready"));
			await flushAsyncWork();
		},
		failWeb: async () => {
			webReady.reject(new Error("web not ready"));
			await flushAsyncWork();
		},
		readyServer: async () => {
			serverReady.resolve();
			await flushAsyncWork();
		},
		readyWeb: async () => {
			webReady.resolve();
			await flushAsyncWork();
		},
		start: () =>
			runProductionDaemon({
				cwd: "/repo",
				env: {},
				cleanupPorts: async (ports) => {
					harness.cleanupCalls.push(ports);
				},
				spawnChild: harness.spawnChild,
				signalTarget: harness.signalTarget,
				startWorkflowWorker: () => ({
					workerId: "worker-1",
					stop: async () => {
						harness.workflowWorkerStopped = true;
					},
				}),
				waitForServerReady: harness.waitForServerReady,
				waitForWebReady: harness.waitForWebReady,
			}),
		spawnChild: ((command: string, args: string[]) => {
			harness.calls.push({ name: serviceName(command, args) });
			const child = new FakeDaemonChild();
			harness.children.push(child);
			return child;
		}) as DaemonSpawn,
		waitForServerReady: ((url: string) => {
			harness.readinessUrls.push(url);
			return serverReady.promise;
		}) as DaemonServiceReadinessProbe,
		waitForWebReady: ((url: string) => {
			harness.readinessUrls.push(url);
			return webReady.promise;
		}) as DaemonServiceReadinessProbe,
	};
	return harness;
}

function serviceName(_command: string, args: string[]): string {
	if (args.includes("devos-server")) return "server";
	if (args.includes("web")) return "web";
	return "workflow-poller";
}

function createDeferred<T>(): {
	promise: Promise<T>;
	reject(error: Error): void;
	resolve(value: T): void;
} {
	let resolvePromise: (value: T) => void = () => {};
	let rejectPromise: (error: Error) => void = () => {};
	const promise = new Promise<T>((resolve, reject) => {
		resolvePromise = resolve;
		rejectPromise = reject;
	});
	return { promise, reject: rejectPromise, resolve: resolvePromise };
}

async function flushAsyncWork(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
}
