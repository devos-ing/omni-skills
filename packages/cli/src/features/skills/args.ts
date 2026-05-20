import type { Command } from "commander";
import type {
	CliRuntime,
	ProjectCommanderOptions,
	SkillAddCommanderOptions,
	SkillUpdateCommanderOptions,
	SkillsCommand,
} from "../../args.types";

export function registerSkillsCommand(
	program: Command,
	runtime: CliRuntime,
): void {
	const skills = program.command("skills").description("manage project skills");
	skills
		.command("list")
		.option("--project <PROJECT_ID>")
		.action(async (options: ProjectCommanderOptions) => {
			await handleSkills(runtime, {
				action: "list",
				projectId: options.project,
			});
		});
	skills
		.command("add")
		.requiredOption("--title <TITLE>")
		.requiredOption("--description <TEXT>")
		.requiredOption("--content <TEXT>")
		.option("--project <PROJECT_ID>")
		.action(async (options: SkillAddCommanderOptions) => {
			await handleSkills(runtime, {
				action: "add",
				title: options.title,
				description: options.description,
				content: options.content,
				projectId: options.project,
			});
		});
	skills
		.command("update <NAME>")
		.option("--title <TITLE>")
		.option("--description <TEXT>")
		.option("--content <TEXT>")
		.option("--project <PROJECT_ID>")
		.action(
			async (
				name: string,
				options: SkillUpdateCommanderOptions,
				command: Command,
			) => {
				if (
					options.title === undefined &&
					options.description === undefined &&
					options.content === undefined
				) {
					command.error(
						"skills update requires at least one of --title, --description, or --content",
					);
				}
				await handleSkills(runtime, {
					action: "update",
					name,
					title: options.title,
					description: options.description,
					content: options.content,
					projectId: options.project,
				});
			},
		);
	skills
		.command("remove <NAME>")
		.option("--project <PROJECT_ID>")
		.action(async (name: string, options: ProjectCommanderOptions) => {
			await handleSkills(runtime, {
				action: "remove",
				name,
				projectId: options.project,
			});
		});
}

async function handleSkills(
	runtime: CliRuntime,
	command: SkillsCommand,
): Promise<void> {
	const config = await runtime.loadConfig();
	await runtime.handleSkillsCommand(config, command);
}
