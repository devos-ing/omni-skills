import type { Command } from "commander";
import type { CliRuntime, StatusCommanderOptions } from "../types/args.types";
import { withConfig } from "./with-config";

export function registerStatusCommand(
	program: Command,
	runtime: CliRuntime,
): void {
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
