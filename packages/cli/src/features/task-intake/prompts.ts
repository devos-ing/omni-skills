import { readFile } from "node:fs/promises";
import type { TaskIntakeAnswer } from "./types/task-intake.types";

async function loadSkillText(filePath: string): Promise<string> {
	try {
		return (await readFile(filePath, "utf8")).trim();
	} catch {
		return "No task-intake skill file was found. Follow workflow instructions directly.";
	}
}

export async function buildTaskIntakePrompt(
	skillPath: string,
	request: string,
	answers: TaskIntakeAnswer[] = [],
): Promise<string> {
	const skill = await loadSkillText(skillPath);
	const answerSection =
		answers.length > 0
			? [
					"Clarifying answers so far:",
					...answers.flatMap((item, index) => [
						`${index + 1}. Q: ${item.question}`,
						`   A: ${item.answer}`,
					]),
				].join("\n")
			: "Clarifying answers so far: none";

	return [
		"You are the task-intake agent in the devos.ing ADHD (Agentic Development Hub & Daemon) workflow.",
		"The default workflow no longer has a separate brainstorm stage, so you are the pre-plan clarification gate.",
		"Your job is to turn a loose operator request into one clear backlog task that a planning agent can process without guessing.",
		"",
		"Use this skill:",
		skill,
		"",
		"Original request:",
		request.trim(),
		"",
		answerSection,
		"",
		"Decide whether the goal and requirements are clear and detailed enough to create one actionable workflow task for the plan stage.",
		"If you have a question that the planning agent would need answered, return NEEDS_INFO and ask the operator for that answer.",
		"Return CLEAR only when the planner can state a success goal and implementation plan without inventing missing requirements.",
		"When asking for clarification, return exactly one concise question for this round. Do not batch multiple questions together.",
		"Prefer an object with a question field and optional options array when the operator can choose between clear alternatives.",
		"Use options only when the choices are meaningful; include two to four options with label and value, plus optional description.",
		"When returning options, mark exactly one best option with recommended: true. The operator may still provide a custom free-form answer.",
		"Return the final section in exactly this contract:",
		"RESULT: CLEAR or NEEDS_INFO",
		'TASK_JSON: {"title":"...","description":"..."}',
		'QUESTIONS_JSON: ["...", {"question":"...","options":[{"label":"...","value":"...","description":"...","recommended":true}]}]',
	].join("\n");
}
