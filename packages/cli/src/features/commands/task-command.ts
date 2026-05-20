import type { TaskCommand } from "../../args";
import type { LoadedConfig } from "../../features/config";
import { getProjectById } from "../../features/config";
import { createAgentAdapter } from "../../integrations/agent-adapters";
import { createBoardTaskCreator } from "../task-intake/board-task-creator";
import { readStdinText, withQuestionReader } from "../task-intake/io";
import { runTaskIntake } from "../task-intake/run";
import type { TaskIntakeRunResult } from "../task-intake/task-intake.types";
import { resolveTaskCreateRequest } from "./task-command-request";

export async function handleTaskCommand(
	config: LoadedConfig,
	command: TaskCommand,
): Promise<void> {
	const project = command.projectId
		? getProjectById(config, command.projectId)
		: config.projects[0];
	if (command.projectId && !project) {
		throw new Error(`Project '${command.projectId}' not found`);
	}
	if (!project) {
		throw new Error("No project is configured");
	}
	const agent = createAgentAdapter(project);
	const taskCreator = createBoardTaskCreator(project);
	const result = command.nonInteractive
		? await runTaskIntake(project, agent, taskCreator, {
				request: resolveNonInteractiveTaskRequest(command.request),
				maxClarificationRounds: command.maxClarificationRounds,
				initialAnswers: command.clarificationAnswers,
				allowInteractiveQuestions: false,
				askQuestion: async () => "",
			})
		: await withQuestionReader(async (askQuestion) => {
				const request = await resolveTaskCreateRequest({
					request: command.request,
					askQuestion,
					readStdin: readStdinText,
				});
				return runTaskIntake(project, agent, taskCreator, {
					request,
					maxClarificationRounds: command.maxClarificationRounds,
					initialAnswers: command.clarificationAnswers,
					askQuestion,
				});
			});
	writeTaskCreateResult(result, command.json === true);
}

function writeTaskCreateResult(
	result: TaskIntakeRunResult,
	json: boolean,
): void {
	if (json) {
		process.stdout.write(`${JSON.stringify(result)}\n`);
		return;
	}
	if (result.status === "created") {
		process.stdout.write(
			`Created task ${result.task.taskKey}: ${result.task.title}\n`,
		);
		return;
	}
	process.stdout.write(
		`${[
			"Task requirements are still unclear; no board task was created.",
			"Remaining questions:",
			...result.questions.map((question) => `- ${question}`),
		].join("\n")}\n`,
	);
}

function resolveNonInteractiveTaskRequest(request: string | undefined): string {
	if (!request || request === "-") {
		throw new Error("task create --non-interactive requires --request <TEXT>");
	}
	const trimmedRequest = request.trim();
	if (!trimmedRequest) {
		throw new Error("task create requires a non-empty request");
	}
	return trimmedRequest;
}
