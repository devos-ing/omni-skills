export interface OperatorIssueActionsContextValue {
	createIssueRequest: number;
	createSessionRequest: number;
	requestNewIssue: () => void;
	requestNewSession: () => void;
	requestOpenIssue: (taskId: string) => void;
}
