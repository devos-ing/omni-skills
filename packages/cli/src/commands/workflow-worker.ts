import type { Command } from "commander";
import type { CliRuntime } from "../types/args.types";

export function registerWorkflowWorkerCommand(
	program: Command,
	runtime: CliRuntime,
): void {
	const runWorker = async () => {
		process.exitCode = await runtime.runWorkflowCommandWorker({
			cwd: runtime.cwd,
		});
	};

	program
		.command("workflow-worker")
		.description("connect to /api/workflow and execute CLI commands")
		.action(runWorker);

	program
		.command("worker")
		.description("register this computer and connect to /api/workflow")
		.action(runWorker);
}
