import path from "node:path";
import type { CommandResult } from "../../utils/shell";
import type { LoadedConfig } from "../config";
import { RTK_INSTALL_URL } from "./constants";
import type { SetupCheck, SetupCheckDeps } from "./setup.types";

export async function safeRun(
	commandRunner: NonNullable<SetupCheckDeps["runCommand"]>,
	command: string,
	args: string[],
	cwd: string,
): Promise<CommandResult> {
	try {
		return await commandRunner(command, args, { cwd });
	} catch (error) {
		return {
			code: 1,
			stdout: "",
			stderr: error instanceof Error ? error.message : String(error),
		};
	}
}

export function commandFailureMessage(result: CommandResult): string {
	const output = (result.stderr || result.stdout).trim();
	return output || `command exited with ${result.code}`;
}

export function formatMissingRtkMessage(): string {
	return `rtk binary not found. Install from: ${RTK_INSTALL_URL}`;
}

export function formatMissingDockerMessage(
	dockerBinary: string,
	result: CommandResult,
): string {
	const output = (result.stderr || result.stdout).trim();
	if (!output) {
		return `${dockerBinary} binary not found but required for codex.docker.enabled projects`;
	}
	return `${dockerBinary} unavailable for codex.docker.enabled projects: ${output}`;
}

export async function checkTrackedConfigSecrets(
	cwd: string,
	config: LoadedConfig,
	readText: NonNullable<SetupCheckDeps["readFile"]>,
): Promise<SetupCheck> {
	const secretValues = new Set<string>();
	for (const project of config.projects) {
		if (project.linear.apiKey) {
			secretValues.add(project.linear.apiKey);
		}
	}
	if (config.notifications.email.resendApiKey) {
		secretValues.add(config.notifications.email.resendApiKey);
	}

	const trackedConfigPaths = ["adhd-ai.config.ts", "piv-loop.config.ts"].map(
		(fileName) => path.join(cwd, fileName),
	);
	for (const configPath of trackedConfigPaths) {
		const content = await readOptionalText(configPath, readText);
		if (!content) {
			continue;
		}
		for (const secret of secretValues) {
			if (secret.length >= 8 && content.includes(secret)) {
				return {
					name: "Tracked config secrets",
					status: "fail",
					message: `${path.basename(configPath)} contains a configured secret`,
				};
			}
		}
	}

	return {
		name: "Tracked config secrets",
		status: "pass",
		message: "no configured secrets found in tracked config files",
	};
}

async function readOptionalText(
	filePath: string,
	readText: NonNullable<SetupCheckDeps["readFile"]>,
): Promise<string | undefined> {
	try {
		return await readText(filePath, "utf8");
	} catch {
		return undefined;
	}
}
