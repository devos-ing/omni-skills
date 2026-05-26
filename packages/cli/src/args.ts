import { Command } from "commander";
import { registerCliCommands } from "./commands";
import type { CliParseOutput, CliRuntime } from "./types/args.types";

export type {
	CliRuntime,
	DaemonCommand,
	OnboardCommand,
	SkillsCommand,
	StatusCommand,
	TaskCommand,
	WorkflowWorkerCommand,
} from "./types/args.types";

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

	registerCliCommands(program, runtime);

	return program;
}
