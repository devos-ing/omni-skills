import type { TaskCreateChatState } from "./task-create-chat-dialog.types";

export function getTaskCreateStatusText(input: {
	isStreaming: boolean;
	result: TaskCreateChatState["result"];
	step: TaskCreateChatState["step"];
}): string {
	if (input.isStreaming) {
		return "Creating task and streaming logs...";
	}
	if (input.result) {
		return `Created ${input.result.task.taskKey}`;
	}
	if (input.step === "clarifying") {
		return "Answer the follow-up questions to finish creating the task.";
	}
	return "Describe the task you want created.";
}
