import type { RunOptions } from "./core/types";

export type SkillsCommand =
	| { action: "list"; projectId?: string }
	| {
			action: "add";
			projectId?: string;
			title: string;
			description: string;
			content: string;
	  }
	| {
			action: "update";
			projectId?: string;
			name: string;
			title?: string;
			description?: string;
			content?: string;
	  }
	| {
			action: "remove";
			projectId?: string;
			name: string;
	  };

export type CliCommand =
	| { kind: "run"; options: RunOptions }
	| { kind: "cron"; jobId?: string; once?: boolean }
	| { kind: "status"; issueKey: string; projectId: string }
	| { kind: "projects" }
	| { kind: "skills"; command: SkillsCommand }
	| { kind: "setup"; check: boolean }
	| { kind: "help" };

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
			},
		};
	}

	if (command === "cron") {
		const args = rest.slice(1);
		const jobId = readFlagValue(args, "--job");
		const once = args.includes("--once");
		return { kind: "cron", jobId, ...(once ? { once } : {}) };
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

	throw new Error(`Unknown command: ${command}`);
}

function parseSkillsCommand(args: string[]): SkillsCommand {
	const action = args[0];
	if (!action) {
		throw new Error(
			"skills command requires an action: list | add | update | remove",
		);
	}

	if (action === "list") {
		return {
			action: "list",
			projectId: readFlagValue(args.slice(1), "--project"),
		};
	}

	if (action === "add") {
		const actionArgs = args.slice(1);
		return {
			action: "add",
			projectId: readFlagValue(actionArgs, "--project"),
			title: readRequiredFlagValue(actionArgs, "--title", "skills add"),
			description: readRequiredFlagValue(
				actionArgs,
				"--description",
				"skills add",
			),
			content: readRequiredFlagValue(actionArgs, "--content", "skills add"),
		};
	}

	if (action === "update") {
		const name = args[1];
		if (!name) {
			throw new Error("skills update requires <NAME>");
		}
		const actionArgs = args.slice(2);
		const title = readFlagValue(actionArgs, "--title");
		const description = readFlagValue(actionArgs, "--description");
		const content = readFlagValue(actionArgs, "--content");
		if (
			title === undefined &&
			description === undefined &&
			content === undefined
		) {
			throw new Error(
				"skills update requires at least one of --title, --description, or --content",
			);
		}
		return {
			action: "update",
			name,
			projectId: readFlagValue(actionArgs, "--project"),
			title,
			description,
			content,
		};
	}

	if (action === "remove") {
		const name = args[1];
		if (!name) {
			throw new Error("skills remove requires <NAME>");
		}
		return {
			action: "remove",
			name,
			projectId: readFlagValue(args.slice(2), "--project"),
		};
	}

	throw new Error(`Unknown skills action: ${action}`);
}

function readFlagValue(args: string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	if (index < 0) {
		return undefined;
	}
	return args[index + 1];
}

function readRequiredFlagValue(
	args: string[],
	flag: string,
	commandLabel: string,
): string {
	const value = readFlagValue(args, flag);
	if (!value) {
		throw new Error(`${commandLabel} requires ${flag} <VALUE>`);
	}
	return value;
}

function readOptionalPositiveInt(
	args: string[],
	flag: string,
): number | undefined {
	const raw = readFlagValue(args, flag);
	if (raw === undefined) {
		return undefined;
	}
	const value = Number(raw);
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${flag} must be a positive integer`);
	}
	return value;
}
