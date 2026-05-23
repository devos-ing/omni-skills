import type { RunCliCommandStreamRequest } from "./command-stream-client.types";

export interface IssueRunCommandInput {
	projectId: string;
	issueKey: string;
}

export function buildIssueRunCommand(
	input: IssueRunCommandInput,
): RunCliCommandStreamRequest {
	return {
		action: "run",
		projectId: input.projectId,
		issueKey: input.issueKey,
	};
}
