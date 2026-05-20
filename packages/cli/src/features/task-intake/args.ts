import { type Command, InvalidArgumentError } from "commander";
import { parsePositiveInt } from "../../args-utils";
import type {
	CliRuntime,
	TaskCommand,
	TaskCreateCommanderOptions,
} from "../../args.types";

export function registerTaskCommand(
	program: Command,
	runtime: CliRuntime,
): void {
	const task = program.command("task").description("manage task intake");
	task
		.command("create [request...]")
		.description("generate a Linear backlog issue from a loose request")
		.option("--request <TEXT|->", "request text, or - to read stdin")
		.option("--project <PROJECT_ID>", "configured project identifier")
		.option("--non-interactive", "disable interactive clarification")
		.option(
			"--max-clarification-rounds <N>",
			"maximum clarification rounds",
			parsePositiveInt,
		)
		.option(
			"--clarifications-json <JSON>",
			"JSON clarification answers",
			parseClarificationAnswers,
		)
		.option("--json", "emit machine-readable output")
		.action(
			async (requestTokens: string[], options: TaskCreateCommanderOptions) => {
				const command: TaskCommand = {
					action: "create",
					projectId: options.project,
					request: options.request ?? joinRequest(requestTokens),
					nonInteractive: options.nonInteractive ? true : undefined,
					maxClarificationRounds: options.maxClarificationRounds,
					clarificationAnswers: options.clarificationsJson,
					json: options.json ? true : undefined,
				};
				const config = await runtime.loadConfig();
				await runtime.handleTaskCommand(config, command);
			},
		);
}

function parseClarificationAnswers(
	raw: string,
): Array<{ question: string; answer: string }> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new InvalidArgumentError("must be valid JSON");
	}
	if (!Array.isArray(parsed)) {
		throw new InvalidArgumentError("must be an array");
	}
	return parsed.map(parseClarificationAnswer);
}

function parseClarificationAnswer(
	entry: unknown,
	index: number,
): { question: string; answer: string } {
	if (!isRecord(entry)) {
		throw new InvalidArgumentError(`entry ${index} must be an object`);
	}
	const question = entry.question;
	const answer = entry.answer;
	if (typeof question !== "string" || question.trim().length === 0) {
		throw new InvalidArgumentError(
			`entry ${index} question must be a non-empty string`,
		);
	}
	if (typeof answer !== "string" || answer.trim().length === 0) {
		throw new InvalidArgumentError(
			`entry ${index} answer must be a non-empty string`,
		);
	}
	return { question: question.trim(), answer: answer.trim() };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function joinRequest(tokens: string[]): string | undefined {
	return tokens.length > 0 ? tokens.join(" ") : undefined;
}
