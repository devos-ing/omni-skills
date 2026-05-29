export type ChatSessionActivityKind =
	| "reading-files"
	| "reading-skills"
	| "reading-docs"
	| "browsing"
	| "writing"
	| "coding"
	| "tool";

export interface ChatSessionActivityBubble {
	id: string;
	kind: ChatSessionActivityKind;
	label: string;
}
