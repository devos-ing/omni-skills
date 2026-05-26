import type { Command } from "commander";
import type { CliRuntime, OnboardCommanderOptions } from "../types/args.types";

export function registerOnboardCommand(
	program: Command,
	runtime: CliRuntime,
): void {
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
