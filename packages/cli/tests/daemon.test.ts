import { describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import {
	type DaemonChild,
	type DaemonSignalTarget,
	type DaemonSpawn,
	buildDaemonCommands,
	runProductionDaemon,
} from "../src/features/daemon";

describe("buildDaemonCommands", () => {
	it("builds production server and web commands with default env", () => {
		const commands = buildDaemonCommands({});

		expect(commands).toEqual([
			{
				name: "server",
				command: "bun",
				args: ["run", "--filter", "devos-server", "start"],
				env: {
					DEVOS_CLI_DAEMON_WS_URL: "ws://127.0.0.1:3002",
					NODE_ENV: "production",
					PIV_SERVER_PORT: "3001",
				},
			},
			{
				name: "web",
				command: "bun",
				args: ["run", "--filter", "web", "start"],
				env: {
					NODE_ENV: "production",
					PORT: "3000",
					DEVOS_SERVER_BASE_URL: "http://127.0.0.1:3001",
					NEXT_PUBLIC_DEVOS_SERVER_WS_URL: "ws://127.0.0.1:3001/api/cli/stream",
				},
			},
			{
				name: "workflow-poller",
				command: "npx",
				args: ["devos", "run", "--all-projects", "--poll-forever"],
				env: {
					DEVOS_SERVER_BASE_URL: "http://127.0.0.1:3001",
					DEVOS_SERVER_EVENTS_WS_URL: "ws://127.0.0.1:3001/daemon/events",
					DEVOS_WORKFLOW_WS_URL: "ws://127.0.0.1:3001/api/workflow",
					NODE_ENV: "production",
				},
			},
		]);
	});

	it("preserves configured ports and server base url", () => {
		const commands = buildDaemonCommands({
			NODE_ENV: "development",
			PIV_SERVER_PORT: "4101",
			PORT: "4102",
			DEVOS_SERVER_BASE_URL: "https://api.example.test",
			DEVOS_CLI_DAEMON_PORT: "4103",
		});

		expect(commands[0]?.env).toMatchObject({
			NODE_ENV: "production",
			PIV_SERVER_PORT: "4101",
			DEVOS_CLI_DAEMON_WS_URL: "ws://127.0.0.1:4103",
		});
		expect(commands[1]?.env).toMatchObject({
			NODE_ENV: "production",
			PORT: "4102",
			DEVOS_SERVER_BASE_URL: "https://api.example.test",
			NEXT_PUBLIC_DEVOS_SERVER_WS_URL: "ws://127.0.0.1:4101/api/cli/stream",
		});
		expect(commands[2]).toMatchObject({
			name: "workflow-poller",
			command: "npx",
			args: ["devos", "run", "--all-projects", "--poll-forever"],
			env: {
				DEVOS_SERVER_BASE_URL: "https://api.example.test",
				DEVOS_SERVER_EVENTS_WS_URL: "wss://api.example.test/daemon/events",
				DEVOS_WORKFLOW_WS_URL: "wss://api.example.test/api/workflow",
				NODE_ENV: "production",
			},
		});
	});

	it("preserves explicit workflow and daemon events websocket urls", () => {
		const commands = buildDaemonCommands({
			DEVOS_SERVER_EVENTS_WS_URL: "ws://events.example.test/socket",
			DEVOS_WORKFLOW_WS_URL: "ws://workflow.example.test/socket",
		});

		expect(commands[2]?.env.DEVOS_SERVER_EVENTS_WS_URL).toBe(
			"ws://events.example.test/socket",
		);
		expect(commands[2]?.env.DEVOS_WORKFLOW_WS_URL).toBe(
			"ws://workflow.example.test/socket",
		);
	});

	it("does not expose the CLI daemon websocket as the web stream target", () => {
		const commands = buildDaemonCommands({
			PIV_SERVER_PORT: "4101",
			DEVOS_CLI_DAEMON_PORT: "4103",
		});
		const serverEnv = commands.find(
			(command) => command.name === "server",
		)?.env;
		const webEnv = commands.find((command) => command.name === "web")?.env;

		expect(serverEnv?.DEVOS_CLI_DAEMON_WS_URL).toBe("ws://127.0.0.1:4103");
		expect(webEnv?.NEXT_PUBLIC_DEVOS_SERVER_WS_URL).toBe(
			"ws://127.0.0.1:4101/api/cli/stream",
		);
		expect(webEnv?.NEXT_PUBLIC_DEVOS_SERVER_WS_URL).not.toBe(
			serverEnv?.DEVOS_CLI_DAEMON_WS_URL,
		);
	});
});

describe("runProductionDaemon", () => {
	it("starts both services in the requested cwd", async () => {
		const harness = createDaemonHarness();

		const done = runProductionDaemon({
			cwd: "/repo",
			env: {},
			spawnChild: harness.spawnChild,
			signalTarget: harness.signalTarget,
			startCommandDaemon: harness.startCommandDaemon,
		});

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
				command: "npx",
				args: ["devos", "run", "--all-projects", "--poll-forever"],
				cwd: "/repo",
			},
		]);
		expect(harness.commandDaemonEnv).toMatchObject({
			DEVOS_SERVER_BASE_URL: "http://127.0.0.1:3001",
			DEVOS_SERVER_EVENTS_WS_URL: "ws://127.0.0.1:3001/daemon/events",
			DEVOS_WORKFLOW_WS_URL: "ws://127.0.0.1:3001/api/workflow",
		});
		harness.children[0]?.emit("close", 0, null);
		await expect(done).resolves.toBe(0);
		expect(harness.commandDaemonStopped).toBe(true);
	});

	it("stops the sibling when one service exits", async () => {
		const harness = createDaemonHarness();
		const done = runProductionDaemon({
			cwd: "/repo",
			env: {},
			spawnChild: harness.spawnChild,
			signalTarget: harness.signalTarget,
			startCommandDaemon: harness.startCommandDaemon,
		});

		harness.children[0]?.emit("close", 7, null);

		await expect(done).resolves.toBe(7);
		expect(harness.children[0]?.killed).toBe(false);
		expect(harness.children[1]?.killed).toBe(true);
		expect(harness.children[2]?.killed).toBe(true);
		expect(harness.children[1]?.signals).toEqual(["SIGTERM"]);
		expect(harness.children[2]?.signals).toEqual(["SIGTERM"]);
	});

	it("stops all services with the received process signal", async () => {
		const harness = createDaemonHarness();
		const done = runProductionDaemon({
			cwd: "/repo",
			env: {},
			spawnChild: harness.spawnChild,
			signalTarget: harness.signalTarget,
			startCommandDaemon: harness.startCommandDaemon,
		});

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
			spawnChild: harness.spawnChild,
			signalTarget: harness.signalTarget,
			startCommandDaemon: harness.startCommandDaemon,
		});

		harness.children[0]?.emit("error", new Error("spawn EACCES"));

		await expect(done).resolves.toBe(1);
		expect(harness.children[1]?.signals).toEqual(["SIGTERM"]);
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

	emitSignal(signal: NodeJS.Signals): void {
		this.emitter.emit(signal);
	}
}

function createDaemonHarness(): {
	calls: Array<{ command: string; args: string[]; cwd: string }>;
	children: FakeDaemonChild[];
	signalTarget: FakeSignalTarget;
	spawnChild: DaemonSpawn;
	startCommandDaemon: NonNullable<
		Parameters<typeof runProductionDaemon>[0]
	>["startCommandDaemon"];
	commandDaemonStopped: boolean;
	commandDaemonEnv: NodeJS.ProcessEnv | undefined;
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
		commandDaemonEnv: undefined as NodeJS.ProcessEnv | undefined,
		commandDaemonStopped: false,
		signalTarget: new FakeSignalTarget(),
		spawnChild,
		startCommandDaemon: (options: { env?: NodeJS.ProcessEnv }) => {
			harness.commandDaemonEnv = options.env;
			return {
				port: 3002,
				stop: async () => {
					harness.commandDaemonStopped = true;
				},
			};
		},
	};
	return harness;
}
