import type { BoardTaskRow, ServerDatabase } from "devos-db";
import {
	boardProjectsTable,
	boardTaskBranchName,
	boardTaskKeyScope,
	taskPullRequestsTable,
} from "devos-db";
import type { BoardTaskApiRecord } from "../tasks/types/task-service.types";
import type {
	WorkflowBoardTaskRecord,
	WorkflowPullRequestRecord,
} from "./types/workflow-data.types";

export async function withPullRequests(
	db: ServerDatabase["db"],
	tasks: Array<BoardTaskApiRecord | BoardTaskRow>,
): Promise<WorkflowBoardTaskRecord[]> {
	if (tasks.length === 0) {
		return [];
	}
	const pullRequests = await db.select().from(taskPullRequestsTable);
	const prsByTaskId = new Map(pullRequests.map((row) => [row.taskId, row]));
	const projects = await db
		.select({ id: boardProjectsTable.id, ownerId: boardProjectsTable.ownerId })
		.from(boardProjectsTable);
	const projectOwners = new Map(
		projects.map((project) => [project.id, project.ownerId]),
	);
	return tasks.map((task) => {
		const branchName = resolveWorkflowBranchName(task, projectOwners);
		return toWorkflowTaskRecord(
			task,
			toPullRequest(task, prsByTaskId.get(task.id), branchName),
			branchName,
		);
	});
}

function toWorkflowTaskRecord(
	task: BoardTaskApiRecord | BoardTaskRow,
	pullRequest?: WorkflowPullRequestRecord,
	branchName?: string,
): WorkflowBoardTaskRecord {
	return { ...task, branchName, pullRequest };
}

function toPullRequest(
	task: BoardTaskApiRecord | BoardTaskRow,
	pullRequest?: typeof taskPullRequestsTable.$inferSelect,
	branchName?: string,
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
			typeof number === "number" && Number.isFinite(number)
				? number
				: undefined,
		url,
		branch: pullRequest?.branch ?? branchName ?? legacyTaskBranchName(task),
		title: `[codex] ${task.taskKey}: ${task.title}`,
	};
}

function resolveWorkflowBranchName(
	task: BoardTaskApiRecord | BoardTaskRow,
	projectOwners: Map<string, string>,
): string | undefined {
	const workspaceId = task.projectId
		? projectOwners.get(task.projectId)
		: task.creatorId;
	const branchName = boardTaskBranchName(task.taskKey);
	const taskScope = boardTaskKeyScope(task.taskKey);
	if (!workspaceId || taskScope !== workspaceId) {
		return undefined;
	}
	return branchName;
}

function legacyTaskBranchName(task: BoardTaskApiRecord | BoardTaskRow): string {
	return `codex/${task.taskKey.toLowerCase()}`;
}

export function parsePrNumber(prUrl: string | undefined): number | undefined {
	const match = prUrl?.match(/\/pull\/(\d+)/);
	return match ? Number(match[1]) : undefined;
}
