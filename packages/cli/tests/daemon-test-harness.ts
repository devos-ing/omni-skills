import { EventEmitter } from "node:events";
import type {
	DaemonChild,
	DaemonSignalTarget,
	DaemonSpawn,
	runProductionDaemon,
} from "../src/features/daemon";

export class FakeDaemonChild extends EventEmitter implements DaemonChild {
	killed = false;
	readonly signals: Array<NodeJS.Signals | undefined> = [];

	kill(signal?: NodeJS.Signals): boolean {
		this.killed = true;
		this.signals.push(signal);
		return true;
	}
}

export class FakeSignalTarget implements DaemonSignalTarget {
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

export function createDaemonHarness(): {
	calls: Array<{ command: string; args: string[]; cwd: string }>;
	children: FakeDaemonChild[];
	signalTarget: FakeSignalTarget;
	spawnChild: DaemonSpawn;
	startWorkflowWorker: NonNullable<
		Parameters<typeof runProductionDaemon>[0]
	>["startWorkflowWorker"];
	workflowWorkerEnv: NodeJS.ProcessEnv | undefined;
	workflowWorkerStopped: boolean;
} {
	const calls: Array<{ command: string; args: string[]; cwd: string }> = [];
	const children: FakeDaemonChild[] = [];
	const spawnChild: DaemonSpawn = (command, args, options) => {
		calls.push({ command, args, cwd: options.cwd });
		const child = new FakeDaemonChild();
		children.push(child);
		return child;
	};

	const harness = {
		calls,
		children,
		signalTarget: new FakeSignalTarget(),
		spawnChild,
		workflowWorkerEnv: undefined as NodeJS.ProcessEnv | undefined,
		workflowWorkerStopped: false,
		startWorkflowWorker: (options: { env?: NodeJS.ProcessEnv }) => {
			harness.workflowWorkerEnv = options.env;
			return {
				workerId: "worker-1",
				stop: async () => {
					harness.workflowWorkerStopped = true;
				},
			};
		},
	};
	return harness;
}

export async function readyImmediately(): Promise<void> {}

export async function flushAsyncWork(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
}
