import type { OnboardCommand, SkillsCommand, StatusCommand } from "../../args";
import type { LoadedConfig } from "../../features/config";
import { getProjectById } from "../../features/config";
import { runSetupCheck, runSetupWizard } from "../../features/setup";
import type { RunOptions } from "../../features/types";
import { formatWorkflowStageDisplay } from "../../utils/status";
import {
	addSkill,
	listSkills,
	removeSkill,
	updateSkill,
} from "../skills/manage";
import { loadRunState, normalizeIssueKey } from "../workflow/state";
import { runWorkflow } from "../workflow/workflow";

export { resolveTaskCreateRequest } from "./task-command-request";

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

export async function handleRunCommand(
	config: LoadedConfig,
	options: RunOptions,
): Promise<void> {
	await runWorkflow(config, options);
}

export async function handleProjectsCommand(
	config: LoadedConfig,
): Promise<void> {
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
}

export async function handleSkillsCommand(
	config: LoadedConfig,
	command: SkillsCommand,
): Promise<void> {
	const selectedProject = command.projectId
		? getProjectById(config, command.projectId)
		: config.projects[0];
	if (command.projectId && !selectedProject) {
		throw new Error(`Project '${command.projectId}' not found`);
	}
	const project = selectedProject;
	if (!project) {
		throw new Error("No project is configured");
	}

	if (command.action === "list") {
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

	if (command.action === "add") {
		const created = await addSkill(project.skills.root, {
			title: command.title,
			description: command.description,
			content: command.content,
		});
		process.stdout.write(`Added skill ${created.name} at ${created.path}\n`);
		return;
	}

	if (command.action === "update") {
		const updated = await updateSkill(project.skills.root, command.name, {
			title: command.title,
			description: command.description,
			content: command.content,
		});
		process.stdout.write(`Updated skill ${updated.name} at ${updated.path}\n`);
		return;
	}

	const removed = await removeSkill(project.skills.root, command.name);
	process.stdout.write(`Removed skill ${removed.name} from ${removed.path}\n`);
}

export async function handleStatusCommand(
	config: LoadedConfig,
	command: StatusCommand,
): Promise<void> {
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
