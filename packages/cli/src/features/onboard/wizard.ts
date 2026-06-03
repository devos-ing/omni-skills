import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runCommand } from "../../utils/shell";
import {
	renderCliHeading,
	renderCliMutedText,
	renderCliOutlineBox,
} from "../../utils/terminal-format";
import { getCliVersion } from "../../version";
import { instanceConfigPath, sqliteEnvDbPath } from "../config";
import { promptForMissingPluginCredentials } from "../plugins/credentials";
import { clackPromptAdapter } from "../prompts";
import { renderDevosBanner } from "./banner";
import {
	collectOnboardChecks,
	formatOnboardChecks,
	renderOnboardGitHubInstallPrompt,
	renderOnboardRtkInstallPrompt,
} from "./checks";
import { commandFailureMessage, safeRun } from "./checks-helpers";
import { ENV_FILE, RTK_INSTALLER_URL } from "./constants";
import { loadInstanceConfig, saveInstanceConfig } from "./instance-config";
import { collectOnboardDraft } from "./onboard-draft";
import { writeOnboardFiles } from "./onboard-files";
import type { OnboardWizardDeps } from "./types/onboard.types";

export async function runOnboardWizard(
	cwd: string,
	deps: OnboardWizardDeps = {},
): Promise<void> {
	const commandRunner = deps.runCommand ?? runCommand;
	const prompts = deps.prompts ?? clackPromptAdapter;
	const writeFiles = deps.writeOnboardFiles ?? writeOnboardFiles;
	const collectChecks = deps.collectOnboardChecks ?? collectOnboardChecks;
	const configurePluginCredentials =
		deps.configurePluginCredentials ?? configureInstalledPluginCredentials;
	const write = deps.write ?? ((chunk: string) => process.stdout.write(chunk));
	write(renderOnboardCustomizationIntro());
	const rtk = await safeRun(commandRunner, "rtk", ["--version"], cwd);
	if (rtk.code !== 0) await promptForRtkInstall(cwd, commandRunner, prompts);
	const gh = await safeRun(commandRunner, "gh", ["auth", "status"], cwd);
	if (gh.code !== 0) write(renderOnboardGitHubInstallPrompt());

	const draft = await collectOnboardDraft(cwd, {
		prompts,
		inferGitHubDefaults: deps.inferGitHubDefaults,
	});
	await writeFiles(cwd, draft);
	await configurePluginCredentials(cwd, prompts);
	write(
		`${renderCliHeading("Onboarding files written:")}\n${ENV_FILE}\nInstance config: ${instanceConfigPath()}\nSecrets saved to ${sqliteEnvDbPath(cwd)}\n\n`,
	);
	write(`${renderDevosBanner()}\n`);
	write(`devos v${getCliVersion()}\n`);
	write(`\n${renderCliHeading("Running doctor checks...")}\n`);
	const checks = await collectChecks(cwd);
	write(formatOnboardChecks(checks));
	if (checks.some((check) => check.status === "fail")) {
		throw new Error("Onboard check failed");
	}
	write(`${renderCliOutlineBox("Next command", "devos daemon")}\n`);
}

async function promptForRtkInstall(
	cwd: string,
	commandRunner: NonNullable<OnboardWizardDeps["runCommand"]>,
	prompts: typeof clackPromptAdapter,
): Promise<void> {
	process.stdout.write(renderOnboardRtkInstallPrompt());
	const install = await prompts.confirm({
		message: "Install RTK now?",
		description:
			"Optional but recommended. RTK shortens noisy command output for coding agents; onboarding will continue if you skip it.",
		initialValue: true,
	});
	if (!install) return;
	await installRtk(cwd, commandRunner);
}

async function installRtk(
	cwd: string,
	commandRunner: NonNullable<OnboardWizardDeps["runCommand"]>,
): Promise<void> {
	const tempDir = await mkdtemp(path.join(tmpdir(), "devos-rtk-install-"));
	const scriptPath = path.join(tempDir, "install.sh");
	try {
		await runChecked(
			commandRunner,
			"curl",
			["-fsSL", RTK_INSTALLER_URL, "-o", scriptPath],
			cwd,
		);
		await runChecked(commandRunner, "sh", [scriptPath], cwd);
	} finally {
		await rm(tempDir, { recursive: true, force: true });
	}
}

async function runChecked(
	commandRunner: NonNullable<OnboardWizardDeps["runCommand"]>,
	command: string,
	args: string[],
	cwd: string,
): Promise<void> {
	const result = await commandRunner(command, args, { cwd });
	if (result.code !== 0) {
		throw new Error(`${command} failed: ${commandFailureMessage(result)}`);
	}
}

function renderOnboardCustomizationIntro(): string {
	const descriptionLines = [
		"devos onboard will configure:",
		"  - Workspace name and execution path",
		"  - Isolated worktrees",
		"  - Local instance server settings",
		"  - Database, logs, storage, secrets, and telemetry",
		"  - Codex models, reasoning, plugins, skills, sandbox, and hooks",
		"  - Doctor checks after files are written",
	];
	return [
		`${renderCliHeading("Customize this workspace")}`,
		...descriptionLines.map((line) => renderCliMutedText(line)),
		"",
	].join("\n");
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
