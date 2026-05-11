import { type CommandResult, runCommand } from "../src/utils/shell";

export type RunCommandFn = (
	command: string,
	args: string[],
	options: {
		cwd: string;
		env?: Record<string, string | undefined>;
		streamStdout?: boolean;
		streamStderr?: boolean;
		stdinMode?: "ignore" | "pipe";
	},
) => Promise<CommandResult>;

export async function runPublishVersion(
	cwd: string,
	commandRunner: RunCommandFn = runCommand,
): Promise<void> {
	const commands: Array<{ command: string; args: string[] }> = [
		{ command: "git", args: ["status", "--porcelain"] },
		{ command: "bun", args: ["run", "changeset", "version"] },
		{ command: "bun", args: ["run", "check"] },
		{ command: "bun", args: ["run", "typecheck"] },
		{ command: "bun", args: ["test"] },
		{ command: "bun", args: ["run", "build"] },
		{ command: "bun", args: ["run", "changeset", "publish"] },
	];

	for (const step of commands) {
		const result = await commandRunner(step.command, step.args, {
			cwd,
			streamStdout: true,
			streamStderr: true,
		});
		if (step.command === "git" && step.args[0] === "status") {
			if (result.code !== 0) {
				throw new Error(
					`Failed to verify git status:\n${result.stderr || result.stdout}`,
				);
			}
			if (result.stdout.trim().length > 0) {
				throw new Error(
					"Working tree is not clean. Commit or stash changes before publishing.",
				);
			}
			continue;
		}
		if (result.code !== 0) {
			throw new Error(
				`${step.command} ${step.args.join(" ")} failed with ${result.code}\n${result.stderr || result.stdout}`,
			);
		}
	}
}

if (import.meta.main) {
	await runPublishVersion(process.cwd());
}
