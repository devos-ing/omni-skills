import type {
	ChatMessageRecord,
	ChatSessionRecord,
	CliCommandStreamEvent,
	CliCommandStreamRequest,
	TaskCreateAnswer,
} from "@/lib/api";

export interface ChatRoomPanelProps {
	newSessionRequest: number;
}

export interface ChatCommandContext {
	projectId: string | null;
}

export type ParsedChatCommand =
	| { kind: "none" }
	| { kind: "local"; action: "new" }
	| { kind: "local"; action: "project"; projectId: string }
	| {
			kind: "stream";
			action: string;
			label: string;
			request: CliCommandStreamRequest;
	  }
	| { kind: "error"; error: string };

export interface ChatStreamLine {
	id: string;
	stream: "stdout" | "stderr" | "system";
	text: string;
}

export interface ChatTranscriptProps {
	error: Error | null;
	isLoading: boolean;
	messages: ChatMessageRecord[];
	pendingAnswers: string[];
	session: ChatSessionRecord | null;
	streamLines: ChatStreamLine[];
	onAnswerChange: (index: number, value: string) => void;
	onSubmitAnswers: () => void;
}

export interface ChatComposerProps {
	disabled: boolean;
	draft: string;
	isSending: boolean;
	onDraftChange: (value: string) => void;
	onSelectCommand: (value: string) => void;
	onSubmit: () => void;
}

export interface CommandRunResult {
	events: CliCommandStreamEvent[];
	status: "succeeded" | "failed" | "rejected";
}

export type ChatAnswerPayload = TaskCreateAnswer[];
