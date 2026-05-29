export interface WorkflowClarificationOption {
	label?: string;
	value: string;
	description?: string;
	recommended?: boolean;
}

export interface WorkflowClarificationQuestion {
	question: string;
	options?: WorkflowClarificationOption[];
}

export interface WorkflowClarificationAnswer {
	question: string;
	answer: string;
}
