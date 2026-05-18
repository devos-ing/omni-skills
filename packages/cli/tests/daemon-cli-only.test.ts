import { describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import {
	type AttachedPoller,
	type AttachedPollerSpawn,
	type CliCommandDaemon,
	type DaemonSignalTarget,
	runCliCommandDaemonOnly,
} from "../src/features/daemon";

describe("runCliCommandDaemonOnly", () => {
	it("starts the command daemon and stops it on process signal", async () => {
		const signalTarget = new FakeSignalTarget();
		const messages: string[] = [];
		const harness = createCommandDaemonHarness();
		const done = runCliCommandDaemonOnly({
			cwd: "/repo",
			env: { DEVOS_CLI_DAEMON_PORT: "4103" },
			signalTarget,
			startCommandDaemon: harness.startCommandDaemon,
			write: (message) => messages.push(message),
		});

		expect(harness.calls).toEqual([
			{ cwd: "/repo", env: { DEVOS_CLI_DAEMON_PORT: "4103" } },
		]);
		expect(messages).toEqual([
			"CLI daemon websocket listening on ws://127.0.0.1:4103\n",
		]);

		signalTarget.emitSignal("SIGTERM");

		await expect(done).resolves.toBe(0);
		expect(harness.stopped).toBe(true);
	});

	it("starts an attached poller for cli-only polling mode", async () => {
		const signalTarget = new FakeSignalTarget();
		const messages: string[] = [];
		const harness = createCommandDaemonHarness();
		const pollerHarness = createPollerHarness();
		const done = runCliCommandDaemonOnly({
			cwd: "/repo",
			env: {
				DEVOS_CLI_DAEMON_PORT: "4103",
				DEVOS_SERVER_BASE_URL: "http://127.0.0.1:4101",
			},
			pollForever: true,
			allProjects: true,
			signalTarget,
			startCommandDaemon: harness.startCommandDaemon,
			spawnPoller: pollerHarness.spawnPoller,
			write: (message) => messages.push(message),
		});

		expect(pollerHarness.calls).toEqual([
			{
				command: "npx",
				args: ["devos", "run", "--all-projects", "--poll-forever"],
				cwd: "/repo",
				env: expect.objectContaining({
					DEVOS_SERVER_BASE_URL: "http://127.0.0.1:4101",
					DEVOS_SERVER_EVENTS_WS_URL: "ws://127.0.0.1:4101/daemon/events",
					DEVOS_WORKFLOW_WS_URL: "ws://127.0.0.1:4101/api/workflow",
					DEVOS_WORKFLOW_PROGRESS_STREAM: "1",
				}),
			},
		]);

		signalTarget.emitSignal("SIGINT");

		await expect(done).resolves.toBe(0);
		expect(harness.stopped).toBe(true);
		expect(pollerHarness.poller.signals).toEqual(["SIGINT"]);
		expect(messages).toContain(
			"CLI daemon workflow poller attached with --all-projects --poll-forever\n",
		);
	});

	it("stops cli-only daemon when attached poller exits", async () => {
		const signalTarget = new FakeSignalTarget();
		const harness = createCommandDaemonHarness();
		const pollerHarness = createPollerHarness();
		const done = runCliCommandDaemonOnly({
			cwd: "/repo",
			env: {},
			pollForever: true,
			allProjects: true,
			signalTarget,
			startCommandDaemon: harness.startCommandDaemon,
			spawnPoller: pollerHarness.spawnPoller,
			write: () => {},
		});

		pollerHarness.poller.emit("close", 7, null);

		await expect(done).resolves.toBe(7);
		expect(harness.stopped).toBe(true);
	});
});

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

function createCommandDaemonHarness(): {
	calls: Array<{ cwd: string; env?: NodeJS.ProcessEnv }>;
	startCommandDaemon: (options: {
		cwd: string;
		env?: NodeJS.ProcessEnv;
	}) => CliCommandDaemon;
	stopped: boolean;
} {
	const harness = {
		calls: [] as Array<{ cwd: string; env?: NodeJS.ProcessEnv }>,
		stopped: false,
		startCommandDaemon: (options: {
			cwd: string;
			env?: NodeJS.ProcessEnv;
		}) => {
			harness.calls.push(options);
			return {
				port: 4103,
				stop: async () => {
					harness.stopped = true;
				},
			};
		},
	};
	return harness;
}

class FakeAttachedPoller extends EventEmitter implements AttachedPoller {
	killed = false;
	readonly signals: Array<NodeJS.Signals | undefined> = [];
	readonly stdout = new PassThrough();
	readonly stderr = new PassThrough();

	kill(signal?: NodeJS.Signals): boolean {
		this.killed = true;
		this.signals.push(signal);
		return true;
	}
}

function createPollerHarness(): {
	poller: FakeAttachedPoller;
	calls: Array<{
		command: string;
		args: string[];
		cwd: string;
		env: NodeJS.ProcessEnv;
	}>;
	spawnPoller: AttachedPollerSpawn;
} {
	const poller = new FakeAttachedPoller();
	const calls: Array<{
		command: string;
		args: string[];
		cwd: string;
		env: NodeJS.ProcessEnv;
	}> = [];
	return {
		poller,
		calls,
		spawnPoller: (command, args, options) => {
			calls.push({
				command,
				args,
				cwd: options.cwd,
				env: options.env,
			});
			return poller;
		},
	};
}
