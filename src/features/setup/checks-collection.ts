import { access, readFile } from "node:fs/promises";
import { runCommand } from "../../utils/shell";
import { loadConfig } from "../config";
import type { LoadedConfig } from "../config";
import { addBinaryChecks } from "./checks-binaries";
import { checkTrackedConfigSecrets } from "./checks-helpers";
import type { SetupCheck, SetupCheckDeps } from "./setup.types";

export async function collectSetupChecks(
	cwd: string,
	deps: SetupCheckDeps = {},
): Promise<SetupCheck[]> {
	const configLoader = deps.loadConfig ?? loadConfig;
	const commandRunner = deps.runCommand ?? runCommand;
	const accessPath = deps.access ?? access;
	const readText = deps.readFile ?? readFile;
	const checks: SetupCheck[] = [];

	let config: LoadedConfig;
	try {
		config = await configLoader(cwd);
		checks.push({
			name: "Config",
			status: "pass",
			message: "configuration loaded successfully",
		});
	} catch (error) {
		checks.push({
			name: "Config",
			status: "fail",
			message: error instanceof Error ? error.message : String(error),
		});
		return checks;
	}

	addProjectConfigChecks(checks, config);
	await addProjectPathChecks(checks, config, accessPath);
	await addSkillChecks(checks, config, accessPath);
	await addAutoSelectChecks(checks, config, accessPath);
	await addBinaryChecks(checks, config, commandRunner, cwd);
	checks.push(await checkTrackedConfigSecrets(cwd, config, readText));
	return checks;
}

function addProjectConfigChecks(
	checks: SetupCheck[],
	config: LoadedConfig,
): void {
	const missingApiKeyProjects = config.projects
		.filter((project) => !project.linear.apiKey)
		.map((project) => project.id);
	checks.push(
		missingApiKeyProjects.length === 0
			? {
					name: "Linear API key",
					status: "pass",
					message: "configured for every project",
				}
			: {
					name: "Linear API key",
					status: "fail",
					message: `missing for projects: ${missingApiKeyProjects.join(", ")}`,
				},
	);
}

async function addProjectPathChecks(
	checks: SetupCheck[],
	config: LoadedConfig,
	accessPath: NonNullable<SetupCheckDeps["access"]>,
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
	checks: SetupCheck[],
	config: LoadedConfig,
	accessPath: NonNullable<SetupCheckDeps["access"]>,
): Promise<void> {
	for (const project of config.projects) {
		const skillChecks: Array<[string, string]> = [
			["plan", project.skills.plan],
			["implement", project.skills.implement],
			["reviewTest", project.skills.reviewTest],
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
	checks: SetupCheck[],
	config: LoadedConfig,
	accessPath: NonNullable<SetupCheckDeps["access"]>,
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
