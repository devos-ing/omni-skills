#!/usr/bin/env bun
import { CommanderError } from "commander";
import { type CliRuntime, createCliProgram } from "./args";
import {
	handleOnboardCommand,
	handleProjectsCommand,
	handleRunCommand,
	handleSkillsCommand,
	handleStatusCommand,
} from "./commands/handlers";
import { handleTaskCommand } from "./features/commands/task-command";
import { loadConfig } from "./features/config";
import { runProductionDaemon } from "./features/daemon";
import { PromptCancelledError } from "./features/prompts";
import {
	logger,
	normalizeError,
	setupProcessErrorHandlers,
} from "./utils/logger";

async function main(): Promise<void> {
	setupProcessErrorHandlers();
	const cwd = process.cwd();
	const runtime: CliRuntime = {
		cwd,
		loadConfig: () => loadConfig(cwd),
		handleOnboardCommand,
		runProductionDaemon,
		handleRunCommand,
		handleProjectsCommand,
		handleStatusCommand,
		handleSkillsCommand,
		handleTaskCommand,
	};
	const program = createCliProgram(runtime);
	try {
		if (process.argv.slice(2).length === 0) {
			program.help();
		}
		await program.parseAsync(process.argv);
	} catch (error) {
		if (error instanceof CommanderError) {
			process.exitCode = error.exitCode;
			return;
		}
		throw error;
	}
}

main().catch((error) => {
	if (error instanceof PromptCancelledError) {
		process.exitCode = 1;
		return;
	}
	const message = error instanceof Error ? error.message : String(error);
	logger.error({ err: normalizeError(error) }, message);
	process.exitCode = 1;
});
