import { runCommand } from "../../utils/shell";
import { renderCliHeading } from "../../utils/terminal-format";
import { instanceConfigPath, sqliteEnvDbPath } from "../config";
import { promptForMissingPluginCredentials } from "../plugins/credentials";
import { clackPromptAdapter } from "../prompts";
import { renderDevosBanner } from "./banner";
import {
	collectSetupChecks,
	formatSetupChecks,
	renderSetupGitHubInstallPrompt,
	renderSetupRtkInstallPrompt,
} from "./checks";
import { safeRun } from "./checks-helpers";
import { ENV_FILE } from "./constants";
import { loadInstanceConfig, saveInstanceConfig } from "./instance-config";
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
	const configurePluginCredentials =
		deps.configurePluginCredentials ?? configureInstalledPluginCredentials;
	const rtk = await safeRun(commandRunner, "rtk", ["--version"], cwd);
	if (rtk.code !== 0) process.stdout.write(renderSetupRtkInstallPrompt());
	const gh = await safeRun(commandRunner, "gh", ["auth", "status"], cwd);
	if (gh.code !== 0) process.stdout.write(renderSetupGitHubInstallPrompt());

	const draft = await collectSetupDraft(cwd, {
		prompts,
		inferGitHubDefaults: deps.inferGitHubDefaults,
	});
	await writeFiles(cwd, draft);
	await configurePluginCredentials(cwd, prompts);
	process.stdout.write(
		`${renderCliHeading("Onboarding files written:")}\n${ENV_FILE}\nInstance config: ${instanceConfigPath()}\nSecrets saved to ${sqliteEnvDbPath(cwd)}\n\n`,
	);
	process.stdout.write(`${renderDevosBanner()}\n`);
	process.stdout.write(`\n${renderCliHeading("Running doctor checks...")}\n`);
	const checks = await collectChecks(cwd);
	process.stdout.write(formatSetupChecks(checks));
	if (checks.some((check) => check.status === "fail")) {
		throw new Error("Setup check failed");
	}
}

async function configureInstalledPluginCredentials(
	cwd: string,
	prompts: typeof clackPromptAdapter,
): Promise<void> {
	const result = await loadInstanceConfig(cwd);
	if (!result.ok) return;
	const changed = await promptForMissingPluginCredentials(
		result.config,
		prompts,
	);
	if (changed) {
		await saveInstanceConfig(result.config);
	}
}
