export type ChatSessionActivityKind =
	| "reading-files"
	| "reading-skills"
	| "reading-docs"
	| "browsing"
	| "writing"
	| "coding"
	| "tool";

export interface ChatSessionActivityDetail {
	id: string;
	text: string;
}

export interface ChatSessionActivityMatch {
	detailText: string;
	kind: ChatSessionActivityKind;
	summary: string;
}

export interface ChatSessionActivitySection {
	details: ChatSessionActivityDetail[];
	id: string;
	kind: ChatSessionActivityKind;
	summary: string;
}
