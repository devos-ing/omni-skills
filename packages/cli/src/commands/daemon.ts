import type { Command } from "commander";
import type { CliRuntime } from "../types/args.types";

export function registerDaemonCommand(
	program: Command,
	runtime: CliRuntime,
): void {
	program
		.command("daemon")
		.description("run the production daemon")
		.action(async () => {
			process.exitCode = await runtime.runProductionDaemon({
				cwd: runtime.cwd,
			});
		});
}
