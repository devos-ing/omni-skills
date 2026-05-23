import path from "node:path";
import { runCommand } from "../../utils/shell";
import { renderCliHeading } from "../../utils/terminal-format";
import { clackPromptAdapter } from "../prompts";
import { renderDevosBanner } from "./banner";
import {
	collectSetupChecks,
	formatSetupChecks,
	renderSetupGitHubInstallPrompt,
	renderSetupRtkInstallPrompt,
} from "./checks";
import { safeRun } from "./checks-helpers";
import { ENV_FILE, INSTANCE_CONFIG_FILE } from "./constants";
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
	const collectChecks = deps.collectSetupChecks ?? collectSetupChecks;
	const rtk = await safeRun(commandRunner, "rtk", ["--version"], cwd);
	if (rtk.code !== 0) process.stdout.write(renderSetupRtkInstallPrompt());
	const gh = await safeRun(commandRunner, "gh", ["auth", "status"], cwd);
	if (gh.code !== 0) process.stdout.write(renderSetupGitHubInstallPrompt());

	const draft = await collectSetupDraft(cwd, {
		prompts,
		inferGitHubDefaults: deps.inferGitHubDefaults,
	});
	await writeFiles(cwd, draft);
	const instanceConfigPath = path.join(cwd, INSTANCE_CONFIG_FILE);
	process.stdout.write(
		`${renderCliHeading("Onboarding files written:")}\n${ENV_FILE}\nInstance config: ${instanceConfigPath}\nSecrets saved to .devos/config/env.sqlite\n\n`,
	);
	process.stdout.write(`${renderDevosBanner()}\n`);
	process.stdout.write(`\n${renderCliHeading("Running doctor checks...")}\n`);
	const checks = await collectChecks(cwd);
	process.stdout.write(formatSetupChecks(checks));
	if (checks.some((check) => check.status === "fail")) {
		throw new Error("Setup check failed");
	}
}
