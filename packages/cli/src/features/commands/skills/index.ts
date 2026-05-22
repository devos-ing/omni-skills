import type { SkillsCommand } from "../../../args";
import {
	addSkill,
	listSkills,
	removeSkill,
	updateSkill,
} from "../../../skills/manage";
import { type LoadedConfig, getProjectById } from "../../config";

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
