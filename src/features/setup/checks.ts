import { collectSetupChecks } from "./checks-collection";
import { GITHUB_CLI_INSTALL_URL, RTK_INSTALL_URL } from "./constants";
import type { SetupCheck } from "./setup.types";

export { collectSetupChecks };

export function formatSetupChecks(checks: SetupCheck[]): string {
	const lines = checks.map((check) => {
		const marker = check.status === "pass" ? "PASS" : "FAIL";
		return `${marker}: ${check.name} - ${check.message}`;
	});
	return `${lines.join("\n")}\n`;
}

export async function runSetupCheck(cwd: string): Promise<void> {
	const checks = await collectSetupChecks(cwd);
	process.stdout.write(formatSetupChecks(checks));
	if (checks.some((check) => check.status === "fail")) {
		throw new Error("Setup check failed");
	}
}

export function renderSetupRtkInstallPrompt(): string {
	return `RTK is required for ADHD.ai agent workflow commands.\nInstall RTK before running workflows: ${RTK_INSTALL_URL}\n`;
}

export function renderSetupGitHubInstallPrompt(): string {
	return `GitHub CLI auth is required for ADHD.ai GitHub workflow commands.\nInstall GitHub CLI: ${GITHUB_CLI_INSTALL_URL}\nThen authenticate: gh auth login\n`;
}
