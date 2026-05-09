import { type CommandResult, runCommand } from "../src/utils/shell";

const BUMP_TYPES = new Set(["patch", "minor", "major"]);
const SEMVER_PATTERN =
	/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

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

export function parseReleaseTarget(raw: string | undefined): string {
	if (!raw) {
		throw new Error(
			"Missing version argument. Use one of: patch | minor | major | <semver>",
		);
	}
	if (BUMP_TYPES.has(raw) || SEMVER_PATTERN.test(raw)) {
		return raw;
	}
	throw new Error(
		`Invalid version target '${raw}'. Use patch | minor | major | <semver>`,
	);
}

export async function runPublishVersion(
	cwd: string,
	target: string,
	commandRunner: RunCommandFn = runCommand,
): Promise<void> {
	const commands: Array<{ command: string; args: string[] }> = [
		{ command: "git", args: ["status", "--porcelain"] },
		{ command: "npm", args: ["version", target, "--no-git-tag-version"] },
		{ command: "bun", args: ["run", "check"] },
		{ command: "bun", args: ["run", "typecheck"] },
		{ command: "bun", args: ["test"] },
		{ command: "bun", args: ["run", "build"] },
		{ command: "npm", args: ["publish", "--access", "public"] },
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
	const target = parseReleaseTarget(process.argv[2]);
	await runPublishVersion(process.cwd(), target);
}
