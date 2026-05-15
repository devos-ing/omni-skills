import path from "node:path";
import type { AgentAdapter } from "../../integrations/agent-adapters";
import type { ResolvedProjectConfig } from "../types";
import { parseTaskIntakeDecision } from "./parser";
import { buildTaskIntakePrompt } from "./prompts";
import type {
	RunTaskIntakeOptions,
	TaskIntakeAnswer,
	TaskIntakeRunResult,
	TaskIntakeTaskCreator,
} from "./task-intake.types";

const DEFAULT_MAX_CLARIFICATION_ROUNDS = 5;

export async function runTaskIntake(
	config: ResolvedProjectConfig,
	agent: Pick<AgentAdapter, "runTaskIntake">,
	taskCreator: TaskIntakeTaskCreator,
	options: RunTaskIntakeOptions,
): Promise<TaskIntakeRunResult> {
	const request = options.request.trim();
	if (!request) {
		throw new Error("task create requires a non-empty request");
	}
	const maxClarificationRounds =
		options.maxClarificationRounds ?? DEFAULT_MAX_CLARIFICATION_ROUNDS;
	const suppliedAnswers: TaskIntakeAnswer[] = [
		...(options.initialAnswers ?? []),
		...(options.providedAnswers ?? []),
	];
	const answers: TaskIntakeAnswer[] = [...suppliedAnswers];
	const providedAnswers = new Map(
		suppliedAnswers.map(({ question, answer }) => [question, answer]),
	);
	const allowInteractiveQuestions =
		options.allowInteractiveQuestions ?? !options.nonInteractive;
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
			const task = await taskCreator.createTask(decision.task);
			return { status: "created", task };
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
			if (!allowInteractiveQuestions) {
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
