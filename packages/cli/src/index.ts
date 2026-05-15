#!/usr/bin/env bun
import { parseArgs } from "./args";
import {
	handleCommand,
	handleSetupCommand,
	printHelp,
} from "./commands/handlers";
import { loadConfig } from "./features/config";
import { runProductionDaemon } from "./features/daemon";
import {
	logger,
	normalizeError,
	setupProcessErrorHandlers,
} from "./utils/logger";

async function main(): Promise<void> {
	setupProcessErrorHandlers();
	const command = parseArgs(process.argv);
	if (command.kind === "help") {
		printHelp();
		return;
	}

	const cwd = process.cwd();
	if (command.kind === "setup") {
		await handleSetupCommand(command, cwd);
		return;
	}
	if (command.kind === "daemon") {
		process.exitCode = await runProductionDaemon({ cwd });
		return;
	}

	const config = await loadConfig(cwd);
	await handleCommand(command, config);
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error);
	logger.error({ err: normalizeError(error) }, message);
	process.exitCode = 1;
});
