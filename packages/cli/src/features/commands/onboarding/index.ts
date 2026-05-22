import type { OnboardCommand } from "../../../args";
import { runSetupCheck, runSetupWizard } from "../../setup";

export async function handleOnboardCommand(
	command: OnboardCommand,
	cwd: string,
): Promise<void> {
	if (command.check) {
		await runSetupCheck(cwd);
		return;
	}
	await runSetupWizard(cwd);
}
