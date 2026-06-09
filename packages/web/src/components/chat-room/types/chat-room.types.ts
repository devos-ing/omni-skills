import type { CommandDraftRequest } from "@/components/web-shell/types/operator-issue-actions.types";
import type {
	ChatMessageRecord,
	ChatSessionRecord,
	CliCommandStreamEvent,
	CliCommandStreamRequest,
	TaskClarificationQuestion,
	TaskCreateAnswer,
} from "@/lib/api";
import type { ChatMissionProgressViewModel } from "./chat-mission-progress.types";
import type { ChatRoomHeaderTabKey } from "./chat-room-header-tabs.types";
import type { ChatRoomMainContentMode } from "./chat-room-panel-layout.types";

export interface ChatRoomPanelProps {
	commandDraftRequest: CommandDraftRequest | null;
	initialSessionId?: string;
	onOpenSidebar: () => void;
}

export interface ChatRoomHeaderProps {
	activeTaskId: string | null;
	activeTab: ChatRoomHeaderTabKey;
	isRerunDisabled: boolean;
	isRerunning: boolean;
	isRerunVisible: boolean;
	title: string;
	onOpenAction: () => void;
	onOpenMessages: () => void;
	onOpenSidebar: () => void;
	onOpenTaskDetails: () => void;
	onRerunWorkflow: () => void;
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
	showMissionSkeleton: boolean;
	session: ChatSessionRecord | null;
	streamLines: ChatStreamLine[];
	workingStartedAt: string | null;
	onDraftCommand: (draft: string) => void;
}

export interface ChatTaskDetailViewProps {
	taskId: string | null;
}

export interface ChatActionStatusViewProps {
	missionProgress: ChatMissionProgressViewModel | null;
	showMissionSkeleton: boolean;
}

export interface ChatRoomPanelViewProps {
	activeContentMode: ChatRoomMainContentMode;
	activeTaskId: string | null;
	draft: string;
	isBusy: boolean;
	isMessagesLoading: boolean;
	isRerunDisabled: boolean;
	isRerunning: boolean;
	isRerunVisible: boolean;
	isSending: boolean;
	isPlanning: boolean;
	isThinking: boolean;
	missionProgress: ChatMissionProgressViewModel | null;
	messages: ChatMessageRecord[];
	messagesError: Error | null;
	pendingAnswers: string[];
	pendingQuestionIndex: number;
	selectedSession: ChatSessionRecord | null;
	streamLines: ChatStreamLine[];
	workingStartedAt: string | null;
	onAnswerChange: (index: number, value: string) => void;
	onDraftChange: (value: string) => void;
	onOpenAction: () => void;
	onOpenMessages: () => void;
	onOpenSidebar: () => void;
	onOpenTaskDetails: () => void;
	onRerunWorkflow: () => void;
	onSelectCommand: (value: string) => void;
	onSelectOption: (index: number, value: string) => Promise<void> | void;
	onSubmit: () => void;
	onSubmitAnswers: () => void;
}

export interface ChatComposerProps {
	disabled: boolean;
	draft: string;
	isSending: boolean;
	messageInputFocusRequestId?: number | null;
	placeholder?: string;
	presentation?: "compact" | "hero";
	onDraftChange: (value: string) => void;
	onMessageInputFocusRequestHandled?: (requestId: number) => void;
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

export interface CommandRunResult {
	events: CliCommandStreamEvent[];
	status: "succeeded" | "failed" | "rejected";
}

export type ChatAnswerPayload = TaskCreateAnswer[];
