import type { Command } from "commander";
import { parsePositiveInt } from "../args-utils";
import type { RunOptions } from "../features/types";
import type { CliRuntime, RunCommanderOptions } from "../types/args.types";
import { withConfig } from "./with-config";

export function registerRunCommand(
	program: Command,
	runtime: CliRuntime,
): void {
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
			const runOptions: RunOptions = { poll: true };
			if (options.issue !== undefined) {
				runOptions.issueArg = options.issue;
			}
			if (options.project !== undefined) {
				runOptions.projectId = options.project;
			}
			if (options.allProjects === true) {
				runOptions.allProjects = true;
			}
			if (options.maxPollCycles === undefined) {
				runOptions.pollForever = true;
			}
			if (options.concurrency !== undefined) {
				runOptions.concurrency = options.concurrency;
			}
			if (options.exitWhenIdle === false) {
				runOptions.exitWhenIdle = false;
			}
			if (options.pollIntervalMs !== undefined) {
				runOptions.pollIntervalMs = options.pollIntervalMs;
			}
			if (options.maxPollCycles !== undefined) {
				runOptions.maxPollCycles = options.maxPollCycles;
			}
			if (options.isolatedWorktrees === true) {
				runOptions.isolatedWorktrees = true;
			}
			await withConfig(runtime, (config) =>
				runtime.handleRunCommand(config, runOptions),
			);
		});
}
