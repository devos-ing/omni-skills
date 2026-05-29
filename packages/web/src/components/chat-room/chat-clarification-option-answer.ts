import type { TaskClarificationOption } from "@/lib/api";

export function resolveChatClarificationOptionAnswer(
	option: TaskClarificationOption,
): string {
	return option.label;
}

export function isChatClarificationOptionSelected(
	answer: string,
	option: TaskClarificationOption,
): boolean {
	return answer === resolveChatClarificationOptionAnswer(option);
}
