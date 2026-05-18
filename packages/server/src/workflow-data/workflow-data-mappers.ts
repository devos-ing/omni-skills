import type { BoardTaskRow, ServerDatabase } from "../db";
import { taskPullRequestsTable } from "../db";
import type { BoardTaskApiRecord } from "../tasks/task-service.types";
import type {
	WorkflowBoardTaskRecord,
	WorkflowPullRequestRecord,
} from "./workflow-data.types";

export async function withPullRequests(
	db: ServerDatabase["db"],
	tasks: Array<BoardTaskApiRecord | BoardTaskRow>,
): Promise<WorkflowBoardTaskRecord[]> {
	if (tasks.length === 0) {
		return [];
	}
	const pullRequests = await db.select().from(taskPullRequestsTable);
	const prsByTaskId = new Map(pullRequests.map((row) => [row.taskId, row]));
	return tasks.map((task) =>
		toWorkflowTaskRecord(task, toPullRequest(task, prsByTaskId.get(task.id))),
	);
}

function toWorkflowTaskRecord(
	task: BoardTaskApiRecord | BoardTaskRow,
	pullRequest?: WorkflowPullRequestRecord,
): WorkflowBoardTaskRecord {
	return { ...task, pullRequest };
}

function toPullRequest(
	task: BoardTaskRow,
	pullRequest?: typeof taskPullRequestsTable.$inferSelect,
): WorkflowPullRequestRecord | undefined {
	const url = pullRequest?.prUrl ?? task.linkedPr ?? undefined;
	const number = pullRequest?.prNumber
		? Number(pullRequest.prNumber)
		: parsePrNumber(url);
	if (!url && !number) {
		return undefined;
	}
	return {
		number:
			typeof number === "number" && Number.isFinite(number) ? number : undefined,
		url,
		branch: `codex/${task.taskKey.toLowerCase()}`,
		title: `[codex] ${task.taskKey}: ${task.title}`,
	};
}

export function parsePrNumber(prUrl: string | undefined): number | undefined {
	const match = prUrl?.match(/\/pull\/(\d+)/);
	return match ? Number(match[1]) : undefined;
}
