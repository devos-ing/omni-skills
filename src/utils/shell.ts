import { spawn } from "node:child_process";
import type { CommandResult, RunCommandOptions } from "./shell.types";
export type { CommandResult, RunCommandOptions } from "./shell.types";

export async function runCommand(
	command: string,
	args: string[],
	options: RunCommandOptions,
): Promise<CommandResult> {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: options.cwd,
			env: { ...process.env, ...options.env },
			stdio: [options.stdinMode ?? "ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";

		child.stdout?.on("data", (chunk) => {
			const text = chunk.toString();
			stdout += text;
			if (options.streamStdout) {
				process.stdout.write(text);
			}
		});
		child.stderr?.on("data", (chunk) => {
			const text = chunk.toString();
			stderr += text;
			if (options.streamStderr) {
				process.stderr.write(text);
			}
		});
		child.on("error", reject);
		child.on("close", (code) => {
			resolve({
				code: code ?? 1,
				stdout,
				stderr,
			});
		});
	});
}

export function assertCommandOk(
	command: string,
	args: string[],
	result: CommandResult,
): void {
	if (result.code !== 0) {
		throw new Error(
			`${command} ${args.join(" ")} failed with ${result.code}\n${result.stderr || result.stdout}`,
		);
	}
}
