export interface CommandDraftRequest {
	id: number;
	draft: string;
}

export interface OperatorIssueActionsContextValue {
	commandDraftRequest: CommandDraftRequest | null;
	createIssueRequest: number;
	createSessionRequest: number;
	requestNewIssue: () => void;
	requestNewSession: () => void;
	requestOpenIssue: (taskId: string) => void;
	requestChatCommandDraft: (draft: string) => void;
	requestSearch: () => void;
}
