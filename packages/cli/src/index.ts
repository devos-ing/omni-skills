#!/usr/bin/env bun
import { CommanderError } from "commander";
import { type CliCommand, parseArgs } from "./args";
import { handleCommand, handleOnboardCommand } from "./commands/handlers";
import { loadConfig } from "./features/config";
import {
	runCliCommandDaemonOnly,
	runProductionDaemon,
} from "./features/daemon";
import { PromptCancelledError } from "./features/prompts";
import {
	logger,
	normalizeError,
	setupProcessErrorHandlers,
} from "./utils/logger";

async function main(): Promise<void> {
	setupProcessErrorHandlers();
	let command: CliCommand;
	try {
		command = parseArgs(process.argv);
	} catch (error) {
		if (error instanceof CommanderError) {
			process.exitCode = error.exitCode;
			return;
		}
		throw error;
	}
	if (command.kind === "help") {
		return;
	}

	const cwd = process.cwd();
	if (command.kind === "onboard") {
		await handleOnboardCommand(command, cwd);
		return;
	}
	if (command.kind === "daemon") {
		if (command.cliOnly) {
			process.exitCode = await runCliCommandDaemonOnly({
				cwd,
				pollForever: command.pollForever,
				allProjects: command.allProjects,
			});
			return;
		}
		process.exitCode = await runProductionDaemon({ cwd });
		return;
	}

	const config = await loadConfig(cwd);
	await handleCommand(command, config);
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
