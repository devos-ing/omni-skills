export interface CommandResult {
	code: number;
	stdout: string;
	stderr: string;
}

export interface RunCommandOptions {
	cwd: string;
	env?: Record<string, string | undefined>;
	streamStdout?: boolean;
	streamStderr?: boolean;
	stdinMode?: "ignore" | "pipe";
}
