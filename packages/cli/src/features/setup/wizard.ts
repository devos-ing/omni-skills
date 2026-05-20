import { runCommand } from "../../utils/shell";
import { clackPromptAdapter } from "../prompts";
import {
	renderSetupGitHubInstallPrompt,
	renderSetupRtkInstallPrompt,
} from "./checks";
import { safeRun } from "./checks-helpers";
import { ENV_FILE, INSTANCE_CONFIG_FILE, LOCAL_CONFIG_FILE } from "./constants";
import { collectSetupDraft } from "./setup-draft";
import { writeSetupFiles } from "./setup-files";
import type { SetupWizardDeps } from "./setup.types";

export async function runSetupWizard(
	cwd: string,
	deps: SetupWizardDeps = {},
): Promise<void> {
	const commandRunner = deps.runCommand ?? runCommand;
	const prompts = deps.prompts ?? clackPromptAdapter;
	const writeFiles = deps.writeSetupFiles ?? writeSetupFiles;
	const rtk = await safeRun(commandRunner, "rtk", ["--version"], cwd);
	if (rtk.code !== 0) process.stdout.write(renderSetupRtkInstallPrompt());
	const gh = await safeRun(commandRunner, "gh", ["auth", "status"], cwd);
	if (gh.code !== 0) process.stdout.write(renderSetupGitHubInstallPrompt());

	const draft = await collectSetupDraft(cwd, {
		prompts,
		inferGitHubDefaults: deps.inferGitHubDefaults,
	});
	await writeFiles(cwd, draft);
	process.stdout.write(
		`Onboarding files written: ${ENV_FILE}, ${LOCAL_CONFIG_FILE}, ${INSTANCE_CONFIG_FILE}; secrets saved to .devos/config/env.sqlite\nRun 'devos onboard --check' to validate this machine.\n`,
	);
}
