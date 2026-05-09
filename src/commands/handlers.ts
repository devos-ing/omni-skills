import type { CliCommand } from "../args";
import type { LoadedConfig } from "../core/config";
import { getProjectById } from "../core/config";
import { runSetupCheck, runSetupWizard } from "../core/setup";
import { loadRunState, normalizeIssueKey } from "../core/state";
import { runWorkflow } from "../core/workflow";
import { runCronScheduler } from "../services/cron";
import {
	addSkill,
	listSkills,
	removeSkill,
	updateSkill,
} from "../skills/manage";

type SetupCommand = Extract<CliCommand, { kind: "setup" }>;
type RunnableCommand = Exclude<CliCommand, { kind: "help" } | SetupCommand>;

export async function handleSetupCommand(
	command: SetupCommand,
	cwd: string,
): Promise<void> {
	if (command.check) {
		await runSetupCheck(cwd);
		return;
	}
	await runSetupWizard(cwd);
}

export async function handleCommand(
	command: RunnableCommand,
	config: LoadedConfig,
): Promise<void> {
	if (command.kind === "run") {
		await runWorkflow(config, command.options);
		return;
	}

	if (command.kind === "cron") {
		await runCronScheduler(config, { jobId: command.jobId });
		return;
	}

	if (command.kind === "projects") {
		for (const project of config.projects) {
			process.stdout.write(
				`${[
					project.id,
					project.name,
					`exec=${project.executionPath}`,
					`state=${project.workspacePath}`,
				].join("\t")}\n`,
			);
		}
		return;
	}

	if (command.kind === "skills") {
		const selectedProject = command.command.projectId
			? getProjectById(config, command.command.projectId)
			: config.projects[0];
		if (command.command.projectId && !selectedProject) {
			throw new Error(`Project '${command.command.projectId}' not found`);
		}
		const project = selectedProject;
		if (!project) {
			throw new Error("No project is configured");
		}

		if (command.command.action === "list") {
			const skills = await listSkills(project.skills.root);
			if (skills.length === 0) {
				process.stdout.write(`No skills found in ${project.skills.root}\n`);
				return;
			}
			for (const skill of skills) {
				process.stdout.write(
					`${[skill.name, skill.title, skill.description || "-"].join("\t")}\n`,
				);
			}
			return;
		}

		if (command.command.action === "add") {
			const created = await addSkill(project.skills.root, {
				title: command.command.title,
				description: command.command.description,
				content: command.command.content,
			});
			process.stdout.write(`Added skill ${created.name} at ${created.path}\n`);
			return;
		}

		if (command.command.action === "update") {
			const updated = await updateSkill(
				project.skills.root,
				command.command.name,
				{
					title: command.command.title,
					description: command.command.description,
					content: command.command.content,
				},
			);
			process.stdout.write(
				`Updated skill ${updated.name} at ${updated.path}\n`,
			);
			return;
		}

		const removed = await removeSkill(
			project.skills.root,
			command.command.name,
		);
		process.stdout.write(
			`Removed skill ${removed.name} from ${removed.path}\n`,
		);
		return;
	}

	const project = getProjectById(config, command.projectId);
	if (!project) {
		throw new Error(`Project '${command.projectId}' not found`);
	}
	const key = normalizeIssueKey(command.issueKey);
	const state = await loadRunState(project.workspacePath, project.id, key);
	if (!state) {
		process.stdout.write(
			`No run state found for ${key} in project ${project.id}\n`,
		);
		return;
	}
	const statusDisplay = {
		...state,
		stageDisplay: formatWorkflowStageDisplay(state.stage),
	};
	process.stdout.write(`${JSON.stringify(statusDisplay, null, 2)}\n`);
}

export function printHelp(): void {
	process.stdout.write(
		`${[
			"adhd-ai - Agent-Driven Development Hub (ADHD.ai) CLI orchestration workflow",
			"",
			"Commands:",
			"  adhd-ai run [--project <PROJECT_ID>] [--issue <LINEAR_KEY_OR_URL>] [--poll] [--no-exit-when-idle] [--poll-interval-ms <MS>] [--max-poll-cycles <N>]",
			"  adhd-ai run --all-projects [--issue <LINEAR_KEY_OR_URL>] [--poll] [--no-exit-when-idle]",
			"  adhd-ai cron [--job <JOB_ID>]",
			"  adhd-ai status --project <PROJECT_ID> --issue <LINEAR_KEY>",
			"  adhd-ai projects",
			"  adhd-ai skills list [--project <PROJECT_ID>]",
			"  adhd-ai skills add --title <TITLE> --description <TEXT> --content <TEXT> [--project <PROJECT_ID>]",
			"  adhd-ai skills update <NAME> [--title <TITLE>] [--description <TEXT>] [--content <TEXT>] [--project <PROJECT_ID>]",
			"  adhd-ai skills remove <NAME> [--project <PROJECT_ID>]",
			"  adhd-ai setup [--check]",
			"  adhd-ai help",
			"",
			"Environment:",
			"  LINEAR_API_KEY, LINEAR_STATUS_* state IDs, GITHUB_* repo settings",
		].join("\n")}\n`,
	);
}
