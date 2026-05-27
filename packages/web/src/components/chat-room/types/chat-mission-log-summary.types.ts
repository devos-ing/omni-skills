import type { ChatMissionLogLine } from "./chat-mission-progress.types";

export type ChatMissionLogSummarySource =
	| "user"
	| "assistant"
	| "agent"
	| "error"
	| "system";

export interface ChatMissionLogSummaryGroup {
	id: ChatMissionLogSummarySource;
	label: string;
	latestSnippet: string;
	lineCount: number;
	lines: ChatMissionLogLine[];
}
