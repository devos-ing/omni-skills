import type { TaskCreateAnswer, TaskCreateResponse } from "@/lib/api";

export interface TaskCreateChatDialogProps {
	defaultProjectId: string;
	onClose: () => void;
}

export type TaskCreateChatStep = "request" | "clarifying" | "created";

export interface TaskCreateLogLine {
	id: string;
	stream: "stdout" | "stderr" | "system";
	text: string;
}

export interface TaskCreateChatState {
	request: string;
	projectId: string;
	answers: TaskCreateAnswer[];
	questions: string[];
	step: TaskCreateChatStep;
	errorMessage: string | null;
	result: Extract<TaskCreateResponse, { status: "created" }> | null;
	logs: TaskCreateLogLine[];
}
