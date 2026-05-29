import type { CommandDraftRequest } from "@/components/web-shell/types/operator-issue-actions.types";
import type {
	ChatMessageRecord,
	ChatSessionRecord,
	CliCommandStreamEvent,
	CliCommandStreamRequest,
	TaskClarificationQuestion,
	TaskCreateAnswer,
	WorkspaceProjectRecord,
} from "@/lib/api";
import type { RefObject } from "react";
import type { ChatMissionProgressViewModel } from "./chat-mission-progress.types";

export interface ChatRoomPanelProps {
	commandDraftRequest: CommandDraftRequest | null;
	initialSessionId?: string;
	newSessionRequest: number;
	onSearchRequest: () => void;
}

export interface ChatRoomHeaderProps {
	activeTaskId: string | null;
	isTaskDetailPanelOpen: boolean;
	projectId: string;
	sidebarControlId: string;
	title: string;
	onToggleTaskDetails: () => void;
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
	isPlanning: boolean;
	isThinking: boolean;
	missionProgress: ChatMissionProgressViewModel | null;
	messages: ChatMessageRecord[];
	session: ChatSessionRecord | null;
	streamLines: ChatStreamLine[];
	workingStartedAt: string | null;
	onDraftCommand: (draft: string) => void;
}

export interface ChatTaskDetailPanelProps {
	isOpen: boolean;
	taskId: string | null;
	onClose: () => void;
}

export interface ChatRoomPanelViewProps {
	activeSessionId: string;
	activeTaskId: string | null;
	draft: string;
	isBusy: boolean;
	isCreatingSession: boolean;
	isMessagesLoading: boolean;
	isSessionListLoading: boolean;
	isSending: boolean;
	isPlanning: boolean;
	isTaskDetailPanelOpen: boolean;
	isThinking: boolean;
	missionProgress: ChatMissionProgressViewModel | null;
	messages: ChatMessageRecord[];
	messagesError: Error | null;
	pendingAnswers: string[];
	pendingQuestionIndex: number;
	projects: WorkspaceProjectRecord[];
	selectedSession: ChatSessionRecord | null;
	sidebarControlId: string;
	sidebarToggleRef: RefObject<HTMLInputElement | null>;
	sessions: ChatSessionRecord[];
	sessionsError: Error | null;
	streamLines: ChatStreamLine[];
	workingStartedAt: string | null;
	onAnswerChange: (index: number, value: string) => void;
	onArchiveSession: (sessionId: string) => void;
	onCloseSidebar: () => void;
	onCloseTaskDetails: () => void;
	onDraftChange: (value: string) => void;
	onNewSession: () => void;
	onToggleTaskDetails: () => void;
	onSearch: () => void;
	onSelectCommand: (value: string) => void;
	onSelectOption: (index: number, value: string) => Promise<void> | void;
	onSelectSession: (sessionId: string) => void;
	onSubmit: () => void;
	onSubmitAnswers: () => void;
}

export interface ChatComposerProps {
	disabled: boolean;
	draft: string;
	isSending: boolean;
	placeholder?: string;
	presentation?: "compact" | "hero";
	onDraftChange: (value: string) => void;
	onSelectCommand: (value: string) => void;
	onSubmit: () => void;
}

export interface ChatClarificationComposerProps {
	answers: string[];
	disabled: boolean;
	pendingQuestionIndex: number;
	questions: TaskClarificationQuestion[];
	onAnswerChange: (index: number, value: string) => void;
	onSelectOption: (index: number, value: string) => Promise<void> | void;
	onSubmit: () => void;
}

export type ChatRoomSidebarView = "main" | "settings";

export interface ChatRoomSettingsSidebarProps {
	isActive: boolean;
	onBack: () => void;
	onClose: () => void;
	onNavigate: () => void;
}

export interface CommandRunResult {
	events: CliCommandStreamEvent[];
	status: "succeeded" | "failed" | "rejected";
}

export type ChatAnswerPayload = TaskCreateAnswer[];
