import type {
	CreatedTaskRef,
	ParentIssueRef,
	PlannedSplitTask,
	PullRequestRef,
	ResolvedProjectConfig,
	WorkflowStage,
} from "../types";
import { createBoardTaskWorkflowStore } from "./board-task-workflow-store";
import type {
	BoardTaskWorkflowRecord,
	BoardTaskWorkflowStore,
} from "./types/board-task-workflow-store.types";
import type {
	WorkflowFetchWorkOptions,
	WorkflowIssue,
	WorkflowTaskClient,
} from "./types/workflow.types";

const BACKLOG_STATUS = "backlog";
const READY_STATUS = "plan";
const IN_PROGRESS_STATUS = "in_progress";
const REVIEW_STATUS = "in_review";
const CANCELED_STATUS = "canceled";
const LEGACY_PR_CREATED_STATUS = "pr_created";
const LEGACY_PLANNING_STATUS = "planning";
const LEGACY_READY_STATUS = "todo";
const LEGACY_IN_PROGRESS_STATUS = "implementing";
const LEGACY_REVIEW_STATUSES = ["reviewing", "testing"] as const;
const REVIEW_STATUSES = new Set([REVIEW_STATUS, "done"]);
const DEFAULT_CREATOR_ID = "member-1";

export function createBoardTaskWorkflowClient(
	config: ResolvedProjectConfig,
): WorkflowTaskClient {
	return new BoardTaskWorkflowClient(config);
}

class BoardTaskWorkflowClient implements WorkflowTaskClient {
	private readonly store: BoardTaskWorkflowStore;

	constructor(private readonly config: ResolvedProjectConfig) {
		this.store = createBoardTaskWorkflowStore(config);
	}

	async fetchWork(
		taskKey?: string,
		options: WorkflowFetchWorkOptions = {},
	): Promise<WorkflowIssue[]> {
		const tasks = await this.store.listTasks();
		return tasks
			.filter(({ task }) => this.matchesProjectScope(task.projectId, options))
			.filter(({ task }) => (taskKey ? task.taskKey === taskKey : true))
			.filter(({ task }) =>
				taskKey ? true : normalizeBoardStatus(task.status) === READY_STATUS,
			)
			.map(mapTaskToWorkflowIssue);
	}

	async fetchIssueByIdentifier(taskKey: string): Promise<WorkflowIssue | null> {
		const task = (await this.store.listTasks()).find(
			({ task: row }) => row.taskKey === taskKey,
		);
		return task ? mapTaskToWorkflowIssue(task) : null;
	}

	async fetchReviewOnlyWork(): Promise<WorkflowIssue[]> {
		return (await this.store.listTasks())
			.filter(({ task }) => task.projectId === this.config.id)
			.filter(({ task }) =>
				REVIEW_STATUSES.has(normalizeBoardStatus(task.status)),
			)
			.map(mapTaskToWorkflowIssue);
	}

	async isAssignedState(stateId: string): Promise<boolean> {
		return normalizeBoardStatus(stateId) === READY_STATUS;
	}

	async markStage(issueId: string, stage: string): Promise<void> {
		await this.store.updateTask(issueId, {
			status: normalizeBoardStatus(stage),
		});
	}

	async markCanceled(issueId: string): Promise<void> {
		await this.store.updateTask(issueId, { status: CANCELED_STATUS });
	}

	async updateIssueDetails(
		issueId: string,
		title: string,
		description: string,
	): Promise<void> {
		await this.store.updateTask(issueId, { title, content: description });
	}

	async createBacklogTask(input: {
		title: string;
		description: string;
	}): Promise<CreatedTaskRef> {
		return this.createTask(input.title, input.description, BACKLOG_STATUS);
	}

	async createTodoIssueFromPlan(
		parentIssue: ParentIssueRef,
		task: PlannedSplitTask,
	): Promise<CreatedTaskRef> {
		const description = [
			task.description?.trim() || "No task summary provided by planner.",
			"",
			`Parent task: ${parentIssue.key}`,
			parentIssue.url,
		].join("\n");
		return this.createTask(task.title, description, READY_STATUS);
	}

	async applyStageLabel(
		_issueId: string,
		_stage: WorkflowStage,
	): Promise<void> {}

	async clearWorkflowStageLabels(_issueId: string): Promise<void> {}

	async comment(issueId: string, body: string): Promise<void> {
		await this.store.addComment(issueId, body);
	}

	async listChatClarificationAnswers(issueId: string) {
		return this.store.listChatClarificationAnswers(issueId);
	}

	async publishChatClarification(
		issueId: string,
		questions: Parameters<
			BoardTaskWorkflowStore["publishChatClarification"]
		>[1],
	): Promise<void> {
		await this.store.publishChatClarification(issueId, questions);
	}

	async linkPullRequest(
		issueId: string,
		pullRequest: PullRequestRef,
	): Promise<void> {
		await this.store.linkPullRequest({
			taskId: issueId,
			repository: `${this.config.repo.owner}/${this.config.repo.name}`,
			pullRequest,
		});
	}

	private async createTask(
		title: string,
		content: string,
		status: string,
	): Promise<CreatedTaskRef> {
		const created = await this.store.createTask({
			projectId: this.config.id,
			title,
			content,
			priority: 1,
			status,
			dueDate: null,
			creatorId: DEFAULT_CREATOR_ID,
			linkedPr: null,
			externalIssueId: null,
			externalIdentifier: null,
			externalUrl: null,
		});
		return toCreatedRef(created.id, created.taskKey, created.title);
	}

	private matchesProjectScope(
		projectId: string | null,
		options: WorkflowFetchWorkOptions,
	): boolean {
		return (
			projectId === this.config.id ||
			(options.includeUnprojected === true && projectId === null)
		);
	}
}

function mapTaskToWorkflowIssue(
	record: BoardTaskWorkflowRecord,
): WorkflowIssue {
	const { task, pullRequest } = record;
	return {
		id: task.id,
		identifier: task.taskKey,
		branchName: task.branchName,
		title: task.title,
		description: task.content,
		url: `devos://tasks/${task.id}`,
		projectId: task.projectId ?? undefined,
		creatorId: task.creatorId,
		priority: { value: task.priority, name: `P${task.priority}` },
		labels: [],
		state: {
			id: normalizeBoardStatus(task.status),
			name: normalizeBoardStatus(task.status),
		},
		pullRequest,
	};
}

function normalizeBoardStatus(status: string): string {
	if (status === LEGACY_PLANNING_STATUS) {
		return READY_STATUS;
	}
	if (status === LEGACY_READY_STATUS) {
		return READY_STATUS;
	}
	if (status === LEGACY_IN_PROGRESS_STATUS) {
		return IN_PROGRESS_STATUS;
	}
	return status === LEGACY_PR_CREATED_STATUS ||
		(LEGACY_REVIEW_STATUSES as readonly string[]).includes(status)
		? REVIEW_STATUS
		: status;
}

function toCreatedRef(
	id: string,
	taskKey: string,
	title: string,
): CreatedTaskRef {
	return {
		id,
		identifier: taskKey,
		title,
		url: `devos://tasks/${id}`,
	};
}
