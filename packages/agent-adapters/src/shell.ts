import { spawn } from "node:child_process";
import type { CommandResult, RunCommandOptions } from "./shell.types";
export type { CommandResult, RunCommandOptions } from "./shell.types";

export async function runCommand(
	command: string,
	args: string[],
	options: RunCommandOptions,
): Promise<CommandResult> {
	return new Promise((resolve, reject) => {
		let timedOut = false;
		let forceKillTimer: ReturnType<typeof setTimeout> | undefined;
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
			options.onStdout?.(text);
			if (options.streamStdout) {
				process.stdout.write(text);
			}
		});
		child.stderr?.on("data", (chunk) => {
			const text = chunk.toString();
			stderr += text;
			options.onStderr?.(text);
			if (options.streamStderr) {
				process.stderr.write(text);
			}
		});
		const timeout =
			options.timeoutMs !== undefined
				? setTimeout(() => {
						timedOut = true;
						child.kill("SIGTERM");
						forceKillTimer = setTimeout(() => child.kill("SIGKILL"), 5000);
					}, options.timeoutMs)
				: undefined;
		child.on("error", (error) => {
			if (timeout) {
				clearTimeout(timeout);
			}
			if (forceKillTimer) {
				clearTimeout(forceKillTimer);
			}
			reject(error);
		});
		child.on("close", (code) => {
			if (timeout) {
				clearTimeout(timeout);
			}
			if (forceKillTimer) {
				clearTimeout(forceKillTimer);
			}
			const timeoutMessage = timedOut
				? `${command} ${args.join(" ")} timed out after ${options.timeoutMs}ms`
				: "";
			resolve({
				code: timedOut ? 124 : (code ?? 1),
				stdout,
				stderr: [stderr, timeoutMessage].filter(Boolean).join("\n"),
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
			[
				`${command} failed with exit code ${result.code}`,
				formatCommandOutput("stderr", result.stderr),
				formatCommandOutput("stdout", result.stdout),
				`command: ${formatCommandForError(command, args)}`,
			]
				.filter(Boolean)
				.join("\n"),
		);
	}
}

function formatCommandOutput(label: string, output: string): string {
	const trimmed = output.trim();
	if (!trimmed) {
		return "";
	}
	return `${label}:\n${truncateForError(trimmed)}`;
}

function formatCommandForError(command: string, args: string[]): string {
	return truncateForError([command, ...args.map(formatArgForError)].join(" "));
}

function formatArgForError(arg: string): string {
	if (!arg || /\s/.test(arg)) {
		return JSON.stringify(arg);
	}
	return arg;
}

function truncateForError(value: string): string {
	const limit = 4000;
	return value.length > limit
		? `${value.slice(0, limit)}\n...<truncated>`
		: value;
}
