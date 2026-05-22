import { Command } from "commander";
import { parsePositiveInt } from "./args-utils";
import type {
	CliParseOutput,
	CliRuntime,
	OnboardCommanderOptions,
	RunCommanderOptions,
	StatusCommanderOptions,
} from "./args.types";
import type { LoadedConfig } from "./features/config";
import { registerSkillsCommand } from "./features/skills/args";
import { registerTaskCommand } from "./features/task-intake/args";

export type {
	CliRuntime,
	DaemonCommand,
	OnboardCommand,
	SkillsCommand,
	StatusCommand,
	TaskCommand,
} from "./args.types";

export function createCliProgram(
	runtime: CliRuntime,
	output: CliParseOutput = {},
): Command {
	const program = new Command("devos")
		.description(
			"devos.ing ADHD (Agentic Development Hub & Daemon) CLI orchestration workflow",
		)
		.exitOverride()
		.showHelpAfterError()
		.showSuggestionAfterError();
	program.configureOutput(output);
	program.helpCommand("help [command]", "display help for command");

	registerRunCommand(program, runtime);
	registerDaemonCommand(program, runtime);
	registerOnboardCommand(program, runtime);
	registerStatusCommand(program, runtime);
	program
		.command("projects")
		.description("list configured projects")
		.action(async () => {
			await withConfig(runtime, (config) =>
				runtime.handleProjectsCommand(config),
			);
		});
	registerTaskCommand(program, runtime);
	registerSkillsCommand(program, runtime);

	return program;
}

function registerRunCommand(program: Command, runtime: CliRuntime): void {
	program
		.command("run")
		.description("run workflow orchestration")
		.option("--project <PROJECT_ID>", "select one configured project")
		.option("--all-projects", "run across all configured projects")
		.option("--issue <LINEAR_KEY_OR_URL>", "scope run to a Linear issue")
		.option("--poll", "continue polling for new work")
		.option("--poll-forever", "poll continuously")
		.option("--no-exit-when-idle", "disable automatic exit while idle")
		.option("--concurrency <N>", "worker concurrency", parsePositiveInt)
		.option("--poll-interval-ms <MS>", "poll interval", parsePositiveInt)
		.option("--max-poll-cycles <N>", "max polling cycles", parsePositiveInt)
		.option("--isolated-worktrees", "enable isolated worktree mode")
		.action(async (options: RunCommanderOptions, command: Command) => {
			if (options.project && options.allProjects) {
				command.error("run command cannot use --project with --all-projects");
			}
			if (options.pollForever && options.maxPollCycles !== undefined) {
				command.error(
					"run command cannot use --poll-forever with --max-poll-cycles",
				);
			}
			const isolatedWorktrees = options.isolatedWorktrees ? true : undefined;
			const pollForever =
				options.maxPollCycles === undefined ? true : undefined;
			await withConfig(runtime, (config) =>
				runtime.handleRunCommand(config, {
					issueArg: options.issue,
					projectId: options.project,
					allProjects: !options.project,
					poll: true,
					pollForever,
					concurrency: options.concurrency,
					exitWhenIdle: options.exitWhenIdle === false ? false : undefined,
					pollIntervalMs: options.pollIntervalMs,
					maxPollCycles: options.maxPollCycles,
					...(isolatedWorktrees ? { isolatedWorktrees } : {}),
				}),
			);
		});
}

function registerDaemonCommand(program: Command, runtime: CliRuntime): void {
	program
		.command("daemon")
		.description("run the production daemon")
		.action(async () => {
			process.exitCode = await runtime.runProductionDaemon({
				cwd: runtime.cwd,
			});
		});
}

function registerOnboardCommand(program: Command, runtime: CliRuntime): void {
	program
		.command("onboard")
		.description("run or validate guided onboarding")
		.option("--check", "validate prerequisites without the wizard")
		.action(async (options: OnboardCommanderOptions) => {
			await runtime.handleOnboardCommand(
				{ check: options.check === true },
				runtime.cwd,
			);
		});
}

function registerStatusCommand(program: Command, runtime: CliRuntime): void {
	program
		.command("status")
		.description("inspect persisted run state")
		.requiredOption("--project <PROJECT_ID>", "configured project identifier")
		.requiredOption("--issue <LINEAR_KEY>", "Linear issue key")
		.action(async (options: StatusCommanderOptions) => {
			await withConfig(runtime, (config) =>
				runtime.handleStatusCommand(config, {
					issueKey: options.issue ?? "",
					projectId: options.project ?? "",
				}),
			);
		});
}

async function withConfig(
	runtime: CliRuntime,
	action: (config: LoadedConfig) => Promise<void>,
): Promise<void> {
	const config = await runtime.loadConfig();
	await action(config);
}
