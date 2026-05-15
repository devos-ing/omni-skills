import type { TaskCreateChatState } from "./task-create-chat-dialog.types";

export function createInitialState(
	defaultProjectId: string,
): TaskCreateChatState {
	return {
		request: "",
		projectId: defaultProjectId,
		answers: [],
		questions: [],
		step: "request",
		errorMessage: null,
		result: null,
		logs: [],
	};
}
