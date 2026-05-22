import { CommanderError } from "commander";
import { type CliRuntime, createCliProgram } from "../src/args";
import type { LoadedConfig } from "../src/features/config";

export type RuntimeCall = {
	name: string;
	payload?: unknown;
};

type CapturedProgram =
	| { calls: RuntimeCall[]; error?: undefined; stderr: string; stdout: string }
	| { calls: RuntimeCall[]; error: unknown; stderr: string; stdout: string };

export function createTestRuntime(calls: RuntimeCall[]): CliRuntime {
	const config = {} as LoadedConfig;
	return {
		cwd: "/tmp/devos-test",
		loadConfig: async () => {
			calls.push({ name: "loadConfig" });
			return config;
		},
		handleOnboardCommand: async (command, cwd) => {
			calls.push({ name: "onboard", payload: { command, cwd } });
		},
		runProductionDaemon: async (options) => {
			calls.push({ name: "daemonProduction", payload: options });
			return 0;
		},
		handleRunCommand: async (_config, options) => {
			calls.push({ name: "run", payload: options });
		},
		handleProjectsCommand: async () => {
			calls.push({ name: "projects" });
		},
		handleStatusCommand: async (_config, command) => {
			calls.push({ name: "status", payload: command });
		},
		handleSkillsCommand: async (_config, command) => {
			calls.push({ name: "skills", payload: command });
		},
		handleTaskCommand: async (_config, command) => {
			calls.push({ name: "task", payload: command });
		},
	};
}

export async function captureWithRuntime(
	argv: string[],
): Promise<CapturedProgram> {
	const calls: RuntimeCall[] = [];
	const runtime = createTestRuntime(calls);
	let stderr = "";
	let stdout = "";
	try {
		const program = createCliProgram(runtime, {
			writeErr: (message) => {
				stderr += message;
			},
			writeOut: (message) => {
				stdout += message;
			},
		});
		if (argv.slice(2).length === 0) {
			program.help();
		}
		await program.parseAsync(argv);
		return { calls, stderr, stdout };
	} catch (error) {
		return { calls, error, stderr, stdout };
	}
}

export async function expectCommanderError(argv: string[]): Promise<{
	error: CommanderError;
	stderr: string;
	stdout: string;
}> {
	const result = await captureWithRuntime(argv);
	if (!(result.error instanceof CommanderError)) {
		throw new Error(`Expected CommanderError for ${argv.join(" ")}`);
	}
	return {
		error: result.error,
		stderr: result.stderr,
		stdout: result.stdout,
	};
}
