import type {
	InboxMessageRecord,
	ProjectBoardTaskRecord,
	WorkspaceProjectRecord,
} from "../../api";
import type {
	RealtimeConnectionStatus,
	RealtimeEvent,
} from "./realtime-events.types";

export interface RealtimeStoreState {
	status: RealtimeConnectionStatus;
	lastError: string | null;
	lastEvent: RealtimeEvent | null;
	chatStreamsByRunId: Record<string, RealtimeChatStreamBuffer>;
	issuesById: Record<string, ProjectBoardTaskRecord>;
	projectsById: Record<string, WorkspaceProjectRecord>;
	inboxMessagesByScope: Record<string, InboxMessageRecord[]>;
}

export interface RealtimeChatStreamBuffer {
	runId: string;
	sessionId: string;
	userMessageId: string | null;
	content: string;
	status: "loading" | "streaming" | "completed" | "error";
	error: string | null;
	completedMessageId: string | null;
	startedAt: string;
	updatedAt: string;
}

export interface RealtimeStoreActions {
	setConnectionStatus(status: RealtimeConnectionStatus): void;
	setConnectionError(error: string | null): void;
	applyEvent(event: RealtimeEvent): void;
	resetRealtimeState(): void;
}

export type RealtimeStore = RealtimeStoreState & RealtimeStoreActions;
