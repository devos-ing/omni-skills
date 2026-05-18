export class WorkflowDataError extends Error {
	constructor(
		readonly code: string,
		message: string,
	) {
		super(message);
		this.name = "WorkflowDataError";
	}
}

export function workflowError(code: string, message: string): WorkflowDataError {
	return new WorkflowDataError(code, message);
}
