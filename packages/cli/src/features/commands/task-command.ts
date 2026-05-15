import type { CliCommand } from "../../args";
import type { LoadedConfig } from "../../features/config";
import { getProjectById } from "../../features/config";
import { createAgentAdapter } from "../../integrations/agent-adapters";
import { createBoardTaskCreator } from "../task-intake/board-task-creator";
import { readStdinText, withQuestionReader } from "../task-intake/io";
import { runTaskIntake } from "../task-intake/run";
import type { TaskIntakeRunResult } from "../task-intake/task-intake.types";

type TaskCliCommand = Extract<CliCommand, { kind: "task" }>;

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

export async function handleTaskCommand(
	command: TaskCliCommand,
	config: LoadedConfig,
): Promise<void> {
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
	const taskCreator = createBoardTaskCreator(project);
	const result = command.command.nonInteractive
		? await runTaskIntake(project, agent, taskCreator, {
				request: resolveNonInteractiveTaskRequest(command.command.request),
				maxClarificationRounds: command.command.maxClarificationRounds,
				initialAnswers: command.command.clarificationAnswers,
				allowInteractiveQuestions: false,
				askQuestion: async () => "",
			})
		: await withQuestionReader(async (askQuestion) => {
				const request = await resolveTaskCreateRequest({
					request: command.command.request,
					askQuestion,
					readStdin: readStdinText,
				});
				return runTaskIntake(project, agent, taskCreator, {
					request,
					maxClarificationRounds: command.command.maxClarificationRounds,
					initialAnswers: command.command.clarificationAnswers,
					askQuestion,
				});
			});
	writeTaskCreateResult(result, command.command.json === true);
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
			"Task requirements are still unclear; no Linear issue was created.",
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
