import { extractMarkerJsonArray } from "../planning/planner-json";
import type {
	BrainstormDecision,
	BrainstormNeedsInfoDecision,
} from "../types/brainstorm.types";
import type {
	WorkflowClarificationOption,
	WorkflowClarificationQuestion,
} from "../types/workflow-chat.types";

export function parseBrainstormDecision(output: string): BrainstormDecision {
	const result = parseBrainstormResult(output);
	if (result === "needs_info") {
		return {
			result,
			questions: parseBrainstormQuestions(output),
		};
	}
	return {
		result,
		summary: parseBrainstormSummary(output),
	};
}

function parseBrainstormResult(output: string): BrainstormDecision["result"] {
	const match = output.match(
		/(?:^|\n)\s*BRAINSTORM_RESULT\s*:\s*(READY|NEEDS_INFO)\s*(?:\n|$)/i,
	);
	if (!match?.[1]) {
		throw new Error("Brainstorm output must include BRAINSTORM_RESULT.");
	}
	return match[1].toUpperCase() === "NEEDS_INFO" ? "needs_info" : "ready";
}

function parseBrainstormSummary(output: string): string {
	const match = output.match(/(?:^|\n)\s*SUMMARY\s*:\s*([^\n]+)(?:\n|$)/i);
	const summary = match?.[1]?.trim();
	if (!summary) {
		throw new Error("READY brainstorm output must include SUMMARY.");
	}
	return summary;
}

function parseBrainstormQuestions(
	output: string,
): BrainstormNeedsInfoDecision["questions"] {
	const jsonText = extractMarkerJsonArray(output, "QUESTIONS_JSON");
	if (!jsonText) {
		throw new Error(
			"NEEDS_INFO brainstorm output must include QUESTIONS_JSON.",
		);
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonText);
	} catch (error) {
		throw new Error(
			`Failed to parse QUESTIONS_JSON: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
	if (!Array.isArray(parsed)) {
		throw new Error("QUESTIONS_JSON must be a JSON array.");
	}
	const questions = parsed.flatMap(readQuestion);
	if (questions.length === 0) {
		throw new Error("QUESTIONS_JSON must include at least one question.");
	}
	return questions;
}

function readQuestion(input: unknown): WorkflowClarificationQuestion[] {
	if (typeof input === "string" && input.trim()) {
		return [{ question: input.trim() }];
	}
	if (!input || typeof input !== "object" || Array.isArray(input)) {
		return [];
	}
	const record = input as Record<string, unknown>;
	if (typeof record.question !== "string" || !record.question.trim()) {
		return [];
	}
	const options = Array.isArray(record.options)
		? record.options.flatMap(readOption)
		: undefined;
	return [
		{
			question: record.question.trim(),
			...(options?.length ? { options } : {}),
		},
	];
}

function readOption(input: unknown): WorkflowClarificationOption[] {
	if (!input || typeof input !== "object" || Array.isArray(input)) {
		return [];
	}
	const record = input as Record<string, unknown>;
	if (typeof record.value !== "string" || !record.value.trim()) {
		return [];
	}
	const value = record.value.trim();
	const label =
		typeof record.label === "string" && record.label.trim()
			? record.label.trim()
			: value;
	const description =
		typeof record.description === "string" && record.description.trim()
			? record.description.trim()
			: undefined;
	return [
		{
			label,
			value,
			...(description ? { description } : {}),
			...(record.recommended === true ? { recommended: true } : {}),
		},
	];
}
