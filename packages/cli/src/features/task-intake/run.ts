import path from "node:path";
import type { AgentAdapter } from "../../integrations/agent-adapters";
import type { ResolvedProjectConfig } from "../types";
import { parseTaskIntakeDecision } from "./parser";
import { buildTaskIntakePrompt } from "./prompts";
import type {
	TaskIntakeAnswer,
	TaskIntakeLinearClient,
	TaskIntakeRunResult,
} from "./task-intake.types";

const DEFAULT_MAX_CLARIFICATION_ROUNDS = 5;

export interface RunTaskIntakeOptions {
	request: string;
	maxClarificationRounds?: number;
	providedAnswers?: TaskIntakeAnswer[];
	nonInteractive?: boolean;
	askQuestion(question: string): Promise<string>;
}

export async function runTaskIntake(
	config: ResolvedProjectConfig,
	agent: Pick<AgentAdapter, "runTaskIntake">,
	linear: TaskIntakeLinearClient,
	options: RunTaskIntakeOptions,
): Promise<TaskIntakeRunResult> {
	const request = options.request.trim();
	if (!request) {
		throw new Error("task create requires a non-empty request");
	}
	const maxClarificationRounds =
		options.maxClarificationRounds ?? DEFAULT_MAX_CLARIFICATION_ROUNDS;
	const answers: TaskIntakeAnswer[] = [];
	const providedAnswers = new Map<string, string>();
	for (const answer of options.providedAnswers ?? []) {
		const question = answer.question.trim();
		const response = answer.answer.trim();
		if (question.length > 0 && response.length > 0) {
			providedAnswers.set(question, response);
		}
	}
	let clarificationRounds = 0;

	while (true) {
		const prompt = await buildTaskIntakePrompt(
			resolveCreateTaskSkillPath(config),
			request,
			answers,
		);
		const result = await agent.runTaskIntake(prompt);
		const decision = parseTaskIntakeDecision(
			result.finalMessage || result.stdout,
		);
		if (decision.result === "CLEAR") {
			const issue = await linear.createBacklogTask(decision.task);
			return { status: "created", issue };
		}
		if (clarificationRounds >= maxClarificationRounds) {
			return { status: "needs_info", questions: decision.questions };
		}
		clarificationRounds += 1;
		for (const question of decision.questions) {
			const providedAnswer = providedAnswers.get(question);
			if (providedAnswer) {
				answers.push({
					question,
					answer: providedAnswer,
				});
				continue;
			}
			if (options.nonInteractive) {
				return { status: "needs_info", questions: decision.questions };
			}
			answers.push({
				question,
				answer: await options.askQuestion(question),
			});
		}
	}
}

function resolveCreateTaskSkillPath(config: ResolvedProjectConfig): string {
	return (
		config.skills.createTask ??
		path.resolve(config.skills.root, "adhd-explore", "SKILL.md")
	);
}
