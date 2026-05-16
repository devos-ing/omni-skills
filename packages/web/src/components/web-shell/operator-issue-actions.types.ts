export interface OperatorIssueActionsContextValue {
	createIssueRequest: number;
	requestNewIssue: () => void;
	requestOpenIssue: (taskId: string) => void;
}
