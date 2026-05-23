import { describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import {
	type DaemonChild,
	type DaemonPortCleanupPorts,
	type DaemonSignalTarget,
	type DaemonSpawn,
	cleanupDaemonPorts,
	findListenerPids,
	runProductionDaemon,
} from "../src/features/daemon";

describe("daemon port cleanup", () => {
	it("deduplicates listener pids across web and server ports", async () => {
		const pids = await findListenerPids(["3001", "3000"], {
			runCommand: async (_command, args) =>
				args.includes("-iTCP:3001") ? "42\n43\n" : "43\n44\n",
		});

		expect(pids).toEqual([42, 43, 44]);
	});

	it("sends SIGTERM before SIGKILL for remaining listeners", async () => {
		const killed: Array<{ pid: number; signal: NodeJS.Signals }> = [];
		const sleeps: number[] = [];
		let scan = 0;

		await cleanupDaemonPorts(
			{ serverPort: "3001", webPort: "3000" },
			{
				runCommand: async (_command, args) => {
					scan += 1;
					if (scan <= 2) return args.includes("-iTCP:3001") ? "42\n43" : "43";
					return args.includes("-iTCP:3001") ? "42" : "";
				},
				killProcess: (pid, signal) => {
					killed.push({ pid, signal });
				},
				sleep: async (ms) => {
					sleeps.push(ms);
				},
			},
		);

		expect(killed).toEqual([
			{ pid: 42, signal: "SIGTERM" },
			{ pid: 43, signal: "SIGTERM" },
			{ pid: 42, signal: "SIGKILL" },
		]);
		expect(sleeps).toEqual([500]);
	});
});

describe("runProductionDaemon port cleanup", () => {
	it("cleans web and server ports after a non-zero child close", async () => {
		const harness = createDaemonHarness();
		const done = runProductionDaemon({
			cwd: "/repo",
			env: { PIV_SERVER_PORT: "4101", PORT: "4102" },
			spawnChild: harness.spawnChild,
			signalTarget: harness.signalTarget,
			startWorkflowWorker: harness.startWorkflowWorker,
			cleanupPorts: harness.cleanupPorts,
			waitForServerReady: readyImmediately,
			waitForWebReady: readyImmediately,
		});

		harness.children[0]?.emit("close", 7, null);

		await expect(done).resolves.toBe(7);
		expect(harness.cleanupCalls).toEqual([
			{ serverPort: "4101", webPort: "4102" },
		]);
		expect(harness.workflowWorkerStopped).toBe(true);
	});

	it("cleans web and server ports after a child spawn error", async () => {
		const harness = createDaemonHarness();
		const done = runProductionDaemon({
			cwd: "/repo",
			env: {},
			spawnChild: harness.spawnChild,
			signalTarget: harness.signalTarget,
			startWorkflowWorker: harness.startWorkflowWorker,
			cleanupPorts: harness.cleanupPorts,
			waitForServerReady: readyImmediately,
			waitForWebReady: readyImmediately,
		});

		harness.children[0]?.emit("error", new Error("spawn EACCES"));

		await expect(done).resolves.toBe(1);
		expect(harness.cleanupCalls).toEqual([
			{ serverPort: "3001", webPort: "3000" },
		]);
	});

	it("does not clean ports after clean exit or parent signal shutdown", async () => {
		const cleanHarness = createDaemonHarness();
		const cleanDone = runProductionDaemon({
			cwd: "/repo",
			env: {},
			spawnChild: cleanHarness.spawnChild,
			signalTarget: cleanHarness.signalTarget,
			startWorkflowWorker: cleanHarness.startWorkflowWorker,
			cleanupPorts: cleanHarness.cleanupPorts,
			waitForServerReady: readyImmediately,
			waitForWebReady: readyImmediately,
		});
		cleanHarness.children[0]?.emit("close", 0, null);
		await expect(cleanDone).resolves.toBe(0);
		expect(cleanHarness.cleanupCalls).toEqual([]);

		const signalHarness = createDaemonHarness();
		const signalDone = runProductionDaemon({
			cwd: "/repo",
			env: {},
			spawnChild: signalHarness.spawnChild,
			signalTarget: signalHarness.signalTarget,
			startWorkflowWorker: signalHarness.startWorkflowWorker,
			cleanupPorts: signalHarness.cleanupPorts,
			waitForServerReady: readyImmediately,
			waitForWebReady: readyImmediately,
		});
		signalHarness.signalTarget.emitSignal("SIGINT");
		await expect(signalDone).resolves.toBe(0);
		expect(signalHarness.cleanupCalls).toEqual([]);
	});

	it("rejects duplicate ports before spawning children or cleanup", async () => {
		const harness = createDaemonHarness();

		await expect(
			runProductionDaemon({
				env: { PIV_SERVER_PORT: "4101", PORT: "4101" },
				spawnChild: harness.spawnChild,
				signalTarget: harness.signalTarget,
				startWorkflowWorker: harness.startWorkflowWorker,
				cleanupPorts: harness.cleanupPorts,
			}),
		).rejects.toThrow("Daemon port conflict");

		expect(harness.children).toHaveLength(0);
		expect(harness.cleanupCalls).toEqual([]);
		expect(harness.workflowWorkerStopped).toBe(false);
	});
});

class FakeDaemonChild extends EventEmitter implements DaemonChild {
	killed = false;

	kill(): boolean {
		this.killed = true;
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

	emitSignal(signal: NodeJS.Signals): void {
		this.emitter.emit(signal);
	}
}

function createDaemonHarness(): {
	children: FakeDaemonChild[];
	cleanupCalls: DaemonPortCleanupPorts[];
	cleanupPorts: (ports: DaemonPortCleanupPorts) => Promise<void>;
	signalTarget: FakeSignalTarget;
	spawnChild: DaemonSpawn;
	startWorkflowWorker: NonNullable<
		Parameters<typeof runProductionDaemon>[0]
	>["startWorkflowWorker"];
	workflowWorkerStopped: boolean;
} {
	const harness = {
		children: [] as FakeDaemonChild[],
		cleanupCalls: [] as DaemonPortCleanupPorts[],
		signalTarget: new FakeSignalTarget(),
		workflowWorkerStopped: false,
		spawnChild: (() => {
			const child = new FakeDaemonChild();
			harness.children.push(child);
			return child;
		}) as DaemonSpawn,
		cleanupPorts: async (ports: DaemonPortCleanupPorts) => {
			harness.cleanupCalls.push(ports);
		},
		startWorkflowWorker: () => ({
			workerId: "worker-1",
			stop: async () => {
				harness.workflowWorkerStopped = true;
			},
		}),
	};
	return harness;
}

async function readyImmediately(): Promise<void> {}
