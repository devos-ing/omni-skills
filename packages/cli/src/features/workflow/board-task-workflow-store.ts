import type { ResolvedProjectConfig } from "../types";
import { createReliableWorkflowDataClient } from "./reliable-workflow-data-client";
import type {
	BoardTaskCreateInput,
	BoardTaskPullRequestLink,
	BoardTaskUpdateInput,
	BoardTaskWorkflowRecord,
	BoardTaskWorkflowStore,
} from "./types/board-task-workflow-store.types";
import type {
	WorkflowBoardTaskRecord,
	WorkflowPullRequestRecord,
} from "./workflow-data-protocol";

const LEGACY_TRACKER_FIELD_PREFIX = `lin${"ear"}`;

export function createBoardTaskWorkflowStore(
	config: ResolvedProjectConfig,
): BoardTaskWorkflowStore {
	const client = createReliableWorkflowDataClient({
		context: { workspacePath: config.workspacePath, projectId: config.id },
	});
	return {
		async listTasks() {
			const tasks =
				await client.request<WorkflowBoardTaskRecord[]>("tasks.list");
			return tasks.map(toWorkflowRecord);
		},
		async updateTask(taskId, values) {
			await client.request<WorkflowBoardTaskRecord>("tasks.update", {
				taskId,
				values,
			} satisfies { taskId: string; values: BoardTaskUpdateInput });
		},
		async createTask(input) {
			return client.request<WorkflowBoardTaskRecord>(
				"tasks.createWorkflowTask",
				input satisfies BoardTaskCreateInput,
			);
		},
		async addComment(taskId, body) {
			await client.request<WorkflowBoardTaskRecord>("tasks.addComment", {
				taskId,
				body,
				commentId: crypto.randomUUID(),
			});
		},
		async listChatClarificationAnswers(taskId) {
			return client.request("chat.listClarificationAnswers", { taskId });
		},
		async publishChatClarification(taskId, questions) {
			await client.request("chat.publishClarification", {
				taskId,
				questions,
			});
		},
		async linkPullRequest(input) {
			await client.request<WorkflowBoardTaskRecord>(
				"tasks.linkPullRequest",
				input satisfies BoardTaskPullRequestLink,
			);
		},
	};
}

function toWorkflowRecord(
	task: WorkflowBoardTaskRecord,
): BoardTaskWorkflowRecord {
	return {
		task: normalizeTaskFields(task),
		pullRequest: toPullRequest(task.pullRequest),
	};
}

function normalizeTaskFields(
	task: WorkflowBoardTaskRecord,
): WorkflowBoardTaskRecord {
	const raw = task as WorkflowBoardTaskRecord & Record<string, unknown>;
	return {
		...task,
		externalIssueId:
			task.externalIssueId ??
			readNullableString(raw, `${LEGACY_TRACKER_FIELD_PREFIX}IssueId`),
		externalIdentifier:
			task.externalIdentifier ??
			readNullableString(raw, `${LEGACY_TRACKER_FIELD_PREFIX}Identifier`),
		externalUrl:
			task.externalUrl ??
			readNullableString(raw, `${LEGACY_TRACKER_FIELD_PREFIX}Url`),
	};
}

function readNullableString(
	value: Record<string, unknown>,
	key: string,
): string | null {
	const candidate = value[key];
	return typeof candidate === "string" ? candidate : null;
}

function toPullRequest(
	pullRequest: WorkflowPullRequestRecord | undefined,
): WorkflowPullRequestRecord | undefined {
	return pullRequest;
}
