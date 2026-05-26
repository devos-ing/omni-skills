import type { Command } from "commander";
import { registerTaskCommand } from "../features/task-intake/args";
import { registerPluginsCommand } from "../plugins/args";
import { registerSkillsCommand } from "../skills/args";
import type { CliRuntime } from "../types/args.types";
import { registerDaemonCommand } from "./daemon";
import { registerOnboardCommand } from "./onboard";
import { registerRunCommand } from "./run";
import { registerStatusCommand } from "./status";
import { registerWorkflowWorkerCommand } from "./workflow-worker";

export function registerCliCommands(
	program: Command,
	runtime: CliRuntime,
): void {
	registerRunCommand(program, runtime);
	registerDaemonCommand(program, runtime);
	registerWorkflowWorkerCommand(program, runtime);
	registerOnboardCommand(program, runtime);
	registerStatusCommand(program, runtime);
	registerTaskCommand(program, runtime);
	registerSkillsCommand(program, runtime);
	registerPluginsCommand(program, runtime);
}
