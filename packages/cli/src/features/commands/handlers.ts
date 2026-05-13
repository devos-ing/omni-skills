import type { CliCommand } from "../../args";
import type { LoadedConfig } from "../../features/config";
import { getProjectById } from "../../features/config";
import { runSetupCheck, runSetupWizard } from "../../features/setup";
import { createAgentAdapter } from "../../integrations/agent-adapters";
import { LinearClient } from "../../integrations/linear";
import { formatWorkflowStageDisplay } from "../../utils/status";
import {
	addSkill,
	listSkills,
	removeSkill,
	updateSkill,
} from "../skills/manage";
import { readStdinText, withQuestionReader } from "../task-intake/io";
import { runTaskIntake } from "../task-intake/run";
import { loadRunState, normalizeIssueKey } from "../workflow/state";
import { runWorkflow } from "../workflow/workflow";

type SetupCommand = Extract<CliCommand, { kind: "setup" }>;
type RunnableCommand = Exclude<CliCommand, { kind: "help" } | SetupCommand>;

export async function resolveTaskCreateRequest(options: {
	request?: string;
	askQuestion(question: string): Promise<string>;
	readStdin(): Promise<string>;
}): Promise<string> {
	let request = options.request;
	if (request === "-") {
		request = await options.readStdin();
	}
	if (!request) {
		request = await options.askQuestion("Enter task request");
	}
	const trimmedRequest = request.trim();
	if (!trimmedRequest) {
		throw new Error("task create requires a non-empty request");
	}
	return trimmedRequest;
}

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

	if (command.kind === "task") {
		const project = command.command.projectId
			? getProjectById(config, command.command.projectId)
			: config.projects[0];
		if (command.command.projectId && !project) {
			throw new Error(`Project '${command.command.projectId}' not found`);
		}
		if (!project) {
			throw new Error("No project is configured");
		}
		const agent = createAgentAdapter(project);
		const linear = new LinearClient(project);
		const result = await withQuestionReader(async (askQuestion) => {
			const request = await resolveTaskCreateRequest({
				request: command.command.request,
				askQuestion,
				readStdin: readStdinText,
			});
			return runTaskIntake(project, agent, linear, {
				request,
				askQuestion,
			});
		});
		if (result.status === "created") {
			process.stdout.write(
				`Created Linear task ${result.issue.identifier}: ${result.issue.url}\n`,
			);
			return;
		}
		process.stdout.write(
			`${[
				"Task requirements are still unclear; no Linear issue was created.",
				"Remaining questions:",
				...result.questions.map((question) => `- ${question}`),
			].join("\n")}\n`,
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
			"  adhd-ai run [--project <PROJECT_ID>] [--issue <LINEAR_KEY_OR_URL>] [--poll] [--no-exit-when-idle] [--poll-interval-ms <MS>] [--max-poll-cycles <N>] [--isolated-worktrees]",
			"  adhd-ai run --all-projects [--issue <LINEAR_KEY_OR_URL>] [--poll] [--no-exit-when-idle]",
			"  adhd-ai status --project <PROJECT_ID> --issue <LINEAR_KEY>",
			"  adhd-ai projects",
			"  adhd-ai task create [<REQUEST>] [--request <TEXT|->] [--project <PROJECT_ID>]",
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
