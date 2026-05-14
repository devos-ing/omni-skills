import { readFlagValue, readOptionalPositiveInt } from "../../args-utils";
import type { TaskCommand } from "../../args.types";

export function parseTaskCommand(args: string[]): TaskCommand {
	const action = args[0];
	if (!action) {
		throw new Error("task command requires an action: create");
	}
	if (action !== "create") {
		throw new Error(`Unknown task action: ${action}`);
	}
	const actionArgs = args.slice(1);
	const request = readFlagValue(actionArgs, "--request");
	const positionalRequest = request ?? readPositionalRequest(actionArgs);
	const nonInteractive = actionArgs.includes("--non-interactive")
		? true
		: undefined;
	const clarificationsJson = readFlagValue(actionArgs, "--clarifications-json");
	const maxClarificationRounds = readOptionalPositiveInt(
		actionArgs,
		"--max-clarification-rounds",
	);
	return {
		action: "create",
		projectId: readFlagValue(actionArgs, "--project"),
		request: positionalRequest,
		nonInteractive,
		maxClarificationRounds,
		clarificationAnswers: parseClarificationAnswers(clarificationsJson),
	};
}

function parseClarificationAnswers(
	raw: string | undefined,
): Array<{ question: string; answer: string }> | undefined {
	if (raw === undefined) {
		return undefined;
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new Error("task create --clarifications-json must be valid JSON");
	}
	if (!Array.isArray(parsed)) {
		throw new Error("task create --clarifications-json must be an array");
	}
	return parsed.map((entry, index) => {
		if (!isRecord(entry)) {
			throw new Error(
				`task create --clarifications-json entry ${index} must be an object`,
			);
		}
		const question = entry.question;
		const answer = entry.answer;
		if (typeof question !== "string" || question.trim().length === 0) {
			throw new Error(
				`task create --clarifications-json entry ${index} question must be a non-empty string`,
			);
		}
		if (typeof answer !== "string" || answer.trim().length === 0) {
			throw new Error(
				`task create --clarifications-json entry ${index} answer must be a non-empty string`,
			);
		}
		return {
			question: question.trim(),
			answer: answer.trim(),
		};
	});
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPositionalRequest(args: string[]): string | undefined {
	const positional: string[] = [];
	for (let index = 0; index < args.length; index += 1) {
		const token = args[index];
		if (!token) {
			continue;
		}
		if (
			token === "--request" ||
			token === "--project" ||
			token === "--clarifications-json" ||
			token === "--max-clarification-rounds"
		) {
			index += 1;
			continue;
		}
		if (token === "--answers-json") {
			index += 1;
			continue;
		}
		if (token.startsWith("--")) {
			continue;
		}
		positional.push(token);
	}
	return positional.length > 0 ? positional.join(" ") : undefined;
}

function readAnswersJson(
	args: string[],
): Array<{ question: string; answer: string }> | undefined {
	const raw = readFlagValue(args, "--answers-json");
	if (!raw) {
		return undefined;
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new Error("task create --answers-json must be valid JSON");
	}
	if (!Array.isArray(parsed)) {
		throw new Error("task create --answers-json must be a JSON array");
	}

	return parsed.map((row, index) => {
		if (typeof row !== "object" || row === null) {
			throw new Error(
				`task create --answers-json item ${index} must be an object`,
			);
		}
		const question = (row as Record<string, unknown>).question;
		const answer = (row as Record<string, unknown>).answer;
		if (typeof question !== "string" || question.trim().length === 0) {
			throw new Error(
				`task create --answers-json item ${index} must include a non-empty question`,
			);
		}
		if (typeof answer !== "string" || answer.trim().length === 0) {
			throw new Error(
				`task create --answers-json item ${index} must include a non-empty answer`,
			);
		}
		return { question, answer };
	});
}
