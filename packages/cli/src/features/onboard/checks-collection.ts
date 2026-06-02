import { access } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { runCommand } from "../../utils/shell";
import { loadConfig, loadResolvedEnv } from "../config";
import type { LoadedConfig } from "../config";
import { addBinaryChecks } from "./checks-binaries";
import { collectConfigFileCheck } from "./checks-config-file";
import { collectInstanceOnboardChecks } from "./checks-instance";
import { loadInstanceConfig } from "./instance-config";
import type { OnboardCheck, OnboardCheckDeps } from "./types/onboard.types";

export async function collectOnboardChecks(
	cwd: string,
	deps: OnboardCheckDeps = {},
): Promise<OnboardCheck[]> {
	const configLoader = deps.loadConfig ?? loadConfig;
	const envLoader = deps.loadResolvedEnv ?? loadResolvedEnv;
	const instanceLoader = deps.loadInstanceConfig ?? loadInstanceConfig;
	const commandRunner = deps.runCommand ?? runCommand;
	const accessPath = deps.access ?? access;
	const readText = deps.readFile ?? readFile;
	const checks: OnboardCheck[] = [];

	const { check, config, instanceResult } = await collectConfigFileCheck({
		cwd,
		configLoader,
		instanceLoader,
	});
	checks.push(check);
	const env = await loadEnvForChecks(envLoader, cwd);
	checks.push(
		...(await collectInstanceOnboardChecks({
			env,
			instanceResult,
			mkdir: deps.mkdir,
			canBindPort: deps.canBindPort,
		})),
	);
	if (!config) return checks;

	await addTrackedConfigSecretCheck(checks, cwd, config, readText);
	await addProjectPathChecks(checks, config, accessPath);
	await addSkillChecks(checks, config, accessPath);
	await addAutoSelectChecks(checks, config, accessPath);
	await addBinaryChecks(checks, config, commandRunner, cwd);
	return checks;
}

async function addTrackedConfigSecretCheck(
	checks: OnboardCheck[],
	cwd: string,
	config: LoadedConfig,
	readText: NonNullable<OnboardCheckDeps["readFile"]>,
): Promise<void> {
	const secretValues = new Set<string>();
	for (const project of config.projects) {
		if (project.cursor?.apiKey) secretValues.add(project.cursor.apiKey);
		if (project.githubCopilot?.githubToken) {
			secretValues.add(project.githubCopilot.githubToken);
		}
	}
	if (config.notifications.email.resendApiKey) {
		secretValues.add(config.notifications.email.resendApiKey);
	}

	const configPath = path.join(cwd, "devos.config.ts");
	const content = await readOptionalText(configPath, readText);
	if (content) {
		for (const secret of secretValues) {
			if (secret.length >= 8 && content.includes(secret)) {
				checks.push({
					name: "Tracked config secrets",
					status: "fail",
					message: "devos.config.ts contains a configured secret",
				});
				return;
			}
		}
	}
	checks.push({
		name: "Tracked config secrets",
		status: "pass",
		message: "no configured secrets found in tracked config files",
	});
}

async function readOptionalText(
	filePath: string,
	readText: NonNullable<OnboardCheckDeps["readFile"]>,
): Promise<string | undefined> {
	try {
		return await readText(filePath, "utf8");
	} catch {
		return undefined;
	}
}

async function loadEnvForChecks(
	envLoader: NonNullable<OnboardCheckDeps["loadResolvedEnv"]>,
	cwd: string,
): Promise<Record<string, string | undefined>> {
	try {
		return await envLoader(cwd);
	} catch {
		return {};
	}
}

async function addProjectPathChecks(
	checks: OnboardCheck[],
	config: LoadedConfig,
	accessPath: NonNullable<OnboardCheckDeps["access"]>,
): Promise<void> {
	for (const project of config.projects) {
		try {
			await accessPath(project.executionPath);
			checks.push({
				name: `Execution path (${project.id})`,
				status: "pass",
				message: project.executionPath,
			});
		} catch {
			checks.push({
				name: `Execution path (${project.id})`,
				status: "fail",
				message: `${project.executionPath} does not exist or is not accessible`,
			});
		}
	}
}

async function addSkillChecks(
	checks: OnboardCheck[],
	config: LoadedConfig,
	accessPath: NonNullable<OnboardCheckDeps["access"]>,
): Promise<void> {
	for (const project of config.projects) {
		const skillChecks: Array<[string, string]> = [
			["plan", project.skills.plan],
			["implement", project.skills.implement],
			["reviewTest", project.skills.reviewTest],
			["githubComment", project.skills.githubComment],
			["createTask", project.skills.createTask ?? ""],
		];
		for (const [stage, skillPath] of skillChecks) {
			try {
				await accessPath(skillPath);
				checks.push({
					name: `Skill file (${project.id}:${stage})`,
					status: "pass",
					message: skillPath,
				});
			} catch {
				checks.push({
					name: `Skill file (${project.id}:${stage})`,
					status: "fail",
					message: `${skillPath} does not exist or is not accessible`,
				});
			}
		}
	}
}

async function addAutoSelectChecks(
	checks: OnboardCheck[],
	config: LoadedConfig,
	accessPath: NonNullable<OnboardCheckDeps["access"]>,
): Promise<void> {
	for (const project of config.projects) {
		const autoSelect = project.skills.autoSelect;
		if (!autoSelect?.enabled) continue;

		if (autoSelect.sources.folder) {
			try {
				await accessPath(project.skills.root);
				checks.push({
					name: `Skill auto-select folder (${project.id})`,
					status: "pass",
					message: project.skills.root,
				});
			} catch {
				checks.push({
					name: `Skill auto-select folder (${project.id})`,
					status: "fail",
					message: `${project.skills.root} does not exist or is not accessible`,
				});
			}
		}
		if (autoSelect.sources.database) {
			const databasePath = autoSelect.databasePath?.trim();
			if (!databasePath) {
				checks.push({
					name: `Skill auto-select database (${project.id})`,
					status: "fail",
					message:
						"skills.autoSelect.databasePath is required when database source is enabled",
				});
				continue;
			}
			try {
				await accessPath(databasePath);
				checks.push({
					name: `Skill auto-select database (${project.id})`,
					status: "pass",
					message: databasePath,
				});
			} catch {
				checks.push({
					name: `Skill auto-select database (${project.id})`,
					status: "fail",
					message: `${databasePath} does not exist or is not accessible`,
				});
			}
		}
	}
}
