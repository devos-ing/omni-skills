import { readFlagValue, readOptionalPositiveInt } from "./args-utils";
import type { CliCommand } from "./args.types";
import { parseSkillsCommand } from "./features/skills/args";
import { parseTaskCommand } from "./features/task-intake/args";

export type { CliCommand, SkillsCommand, TaskCommand } from "./args.types";

export function parseArgs(argv: string[]): CliCommand {
	const [, , ...rest] = argv;
	const command = rest[0];

	if (
		!command ||
		command === "help" ||
		command === "--help" ||
		command === "-h"
	) {
		return { kind: "help" };
	}

	if (command === "run") {
		const args = rest.slice(1);
		const issueArg = readFlagValue(args, "--issue");
		const projectId = readFlagValue(args, "--project");
		const allProjects = args.includes("--all-projects");
		const poll = args.includes("--poll");
		const exitWhenIdle = args.includes("--no-exit-when-idle")
			? false
			: undefined;
		const concurrency = readOptionalPositiveInt(args, "--concurrency");
		const pollIntervalMs = readOptionalPositiveInt(args, "--poll-interval-ms");
		const maxPollCycles = readOptionalPositiveInt(args, "--max-poll-cycles");
		const isolatedWorktrees = args.includes("--isolated-worktrees")
			? true
			: undefined;
		if (projectId && allProjects) {
			throw new Error("run command cannot use --project with --all-projects");
		}
		return {
			kind: "run",
			options: {
				issueArg,
				projectId,
				allProjects,
				poll,
				concurrency,
				exitWhenIdle,
				pollIntervalMs,
				maxPollCycles,
				...(isolatedWorktrees ? { isolatedWorktrees } : {}),
			},
		};
	}

	if (command === "daemon") {
		return { kind: "daemon" };
	}

	if (command === "setup") {
		const args = rest.slice(1);
		return { kind: "setup", check: args.includes("--check") };
	}

	if (command === "status") {
		const issueKey = readFlagValue(rest.slice(1), "--issue");
		const projectId = readFlagValue(rest.slice(1), "--project");
		if (!issueKey) {
			throw new Error("status command requires --issue <LINEAR_KEY>");
		}
		if (!projectId) {
			throw new Error("status command requires --project <PROJECT_ID>");
		}
		return { kind: "status", issueKey, projectId };
	}

	if (command === "projects") {
		return { kind: "projects" };
	}

	if (command === "skills") {
		return {
			kind: "skills",
			command: parseSkillsCommand(rest.slice(1)),
		};
	}

	if (command === "task") {
		return {
			kind: "task",
			command: parseTaskCommand(rest.slice(1)),
		};
	}

	throw new Error(`Unknown command: ${command}`);
}
