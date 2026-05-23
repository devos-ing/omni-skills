import { describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import {
	DAEMON_READY_DELAY_MS,
	DAEMON_READY_MESSAGE,
	type DaemonChild,
	type DaemonReadinessScheduler,
	type DaemonSignalTarget,
	type DaemonSpawn,
	runProductionDaemon,
} from "../src/features/daemon";

describe("daemon delayed readiness", () => {
	it("prints all ready for production daemon after the readiness delay", async () => {
		const harness = createProductionHarness();
		const readiness = createReadinessHarness();
		const messages: string[] = [];
		const done = runProductionDaemon({
			cwd: "/repo",
			env: {},
			readinessScheduler: readiness.scheduler,
			signalTarget: harness.signalTarget,
			spawnChild: harness.spawnChild,
			startWorkflowWorker: harness.startWorkflowWorker,
			waitForServerReady: readyImmediately,
			waitForWebReady: readyImmediately,
			write: (message) => messages.push(message),
		});
		await flushAsyncWork();

		expect(readiness.delayMs).toBe(DAEMON_READY_DELAY_MS);
		expect(messages).toEqual([]);

		readiness.fire();
		expect(messages).toEqual([DAEMON_READY_MESSAGE]);

		harness.children[0]?.emit("close", 0, null);
		await expect(done).resolves.toBe(0);
	});

	it("cancels production delayed readiness on shutdown", async () => {
		const harness = createProductionHarness();
		const readiness = createReadinessHarness();
		const messages: string[] = [];
		const done = runProductionDaemon({
			cwd: "/repo",
			env: {},
			readinessScheduler: readiness.scheduler,
			signalTarget: harness.signalTarget,
			spawnChild: harness.spawnChild,
			startWorkflowWorker: harness.startWorkflowWorker,
			waitForServerReady: readyImmediately,
			waitForWebReady: readyImmediately,
			write: (message) => messages.push(message),
		});
		await flushAsyncWork();

		harness.signalTarget.emitSignal("SIGTERM");
		await expect(done).resolves.toBe(0);

		expect(readiness.cancelled).toBe(true);
		readiness.fire();
		expect(messages).toEqual([]);
	});
});

function createReadinessHarness(): {
	cancelled: boolean;
	delayMs: number | undefined;
	fire(): void;
	scheduler: DaemonReadinessScheduler;
} {
	const harness = {
		callback: undefined as (() => void) | undefined,
		cancelled: false,
		delayMs: undefined as number | undefined,
		fire() {
			if (!harness.cancelled) {
				harness.callback?.();
			}
		},
		scheduler: (callback: () => void, delayMs: number) => {
			harness.callback = callback;
			harness.delayMs = delayMs;
			return {
				cancel: () => {
					harness.cancelled = true;
				},
			};
		},
	};
	return harness;
}

function createProductionHarness(): {
	children: FakeDaemonChild[];
	signalTarget: FakeSignalTarget;
	spawnChild: DaemonSpawn;
	startWorkflowWorker: NonNullable<
		Parameters<typeof runProductionDaemon>[0]
	>["startWorkflowWorker"];
} {
	const children: FakeDaemonChild[] = [];
	return {
		children,
		signalTarget: new FakeSignalTarget(),
		spawnChild: () => {
			const child = new FakeDaemonChild();
			children.push(child);
			return child;
		},
		startWorkflowWorker: () => ({
			workerId: "worker-1",
			stop: async () => {},
		}),
	};
}

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

async function readyImmediately(): Promise<void> {}

async function flushAsyncWork(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
}
