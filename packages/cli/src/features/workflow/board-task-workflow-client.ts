import {
	boardTasksTable,
	generateBoardTaskKey,
	initializeServerDatabase,
	taskCommentsTable,
} from "devos-server/db";
import { eq } from "drizzle-orm";
import type { CreatedLinearIssueRef } from "../../integrations/linear";
import type {
	ParentIssueRef,
	PlannedSplitTask,
	ResolvedProjectConfig,
	WorkflowStage,
} from "../types";
import type { WorkflowIssue, WorkflowLinearClient } from "./workflow.types";

const READY_STATUS = "planning";
const REVIEW_STATUSES = new Set(["pr_created", "reviewing", "testing", "done"]);
const DEFAULT_CREATOR_ID = "member-1";

export function createBoardTaskWorkflowClient(
	config: ResolvedProjectConfig,
): WorkflowLinearClient {
	return new BoardTaskWorkflowClient(config);
}

class BoardTaskWorkflowClient implements WorkflowLinearClient {
	constructor(private readonly config: ResolvedProjectConfig) {}

	async fetchWork(taskKey?: string): Promise<WorkflowIssue[]> {
		const tasks = await this.readTasks();
		return tasks
			.filter((task) => task.projectId === this.config.id)
			.filter((task) => (taskKey ? task.taskKey === taskKey : true))
			.filter((task) => (taskKey ? true : task.status === READY_STATUS))
			.map(mapTaskToWorkflowIssue);
	}

	async fetchIssueByIdentifier(taskKey: string): Promise<WorkflowIssue | null> {
		const task = (await this.readTasks()).find(
			(row) => row.taskKey === taskKey,
		);
		return task ? mapTaskToWorkflowIssue(task) : null;
	}

	async fetchReviewOnlyWork(): Promise<WorkflowIssue[]> {
		return (await this.readTasks())
			.filter((task) => task.projectId === this.config.id)
			.filter((task) => REVIEW_STATUSES.has(task.status))
			.map(mapTaskToWorkflowIssue);
	}

	async isAssignedState(stateId: string): Promise<boolean> {
		return stateId === READY_STATUS;
	}

	async markStage(issueId: string, stage: string): Promise<void> {
		await this.updateTask(issueId, { status: stage });
	}

	async markCanceled(issueId: string): Promise<void> {
		await this.updateTask(issueId, { status: "blocked" });
	}

	async updateIssueDetails(
		issueId: string,
		title: string,
		description: string,
	): Promise<void> {
		await this.updateTask(issueId, { title, content: description });
	}

	async createBacklogTask(input: {
		title: string;
		description: string;
	}): Promise<CreatedLinearIssueRef> {
		return this.createTask(input.title, input.description, READY_STATUS);
	}

	async createTodoIssueFromPlan(
		parentIssue: ParentIssueRef,
		task: PlannedSplitTask,
	): Promise<CreatedLinearIssueRef> {
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
		const database = await initializeServerDatabase(
			this.config.server.database.databasePath,
		);
		try {
			await database.db.insert(taskCommentsTable).values({
				id: crypto.randomUUID(),
				taskId: issueId,
				authorId: "devos",
				authorType: "agent",
				comment: body,
				createdAt: new Date().toISOString(),
			});
		} finally {
			await database.close();
		}
	}

	private async createTask(
		title: string,
		content: string,
		status: string,
	): Promise<CreatedLinearIssueRef> {
		const database = await initializeServerDatabase(
			this.config.server.database.databasePath,
		);
		try {
			const now = new Date().toISOString();
			const [created] = await database.db
				.insert(boardTasksTable)
				.values({
					id: crypto.randomUUID(),
					taskKey: await generateBoardTaskKey(database.db),
					projectId: this.config.id,
					title,
					content,
					priority: 1,
					status,
					dueDate: null,
					creatorId: DEFAULT_CREATOR_ID,
					linkedPr: null,
					linearIssueId: null,
					linearIdentifier: null,
					linearUrl: null,
					createdAt: now,
					updatedAt: now,
				})
				.returning();
			if (!created) {
				throw new Error("Board task was not created");
			}
			return toCreatedRef(created.id, created.taskKey, created.title);
		} finally {
			await database.close();
		}
	}

	private async readTasks(): Promise<
		Array<typeof boardTasksTable.$inferSelect>
	> {
		const database = await initializeServerDatabase(
			this.config.server.database.databasePath,
		);
		try {
			return await database.db.select().from(boardTasksTable);
		} finally {
			await database.close();
		}
	}

	private async updateTask(
		issueId: string,
		values: Partial<typeof boardTasksTable.$inferInsert>,
	): Promise<void> {
		const database = await initializeServerDatabase(
			this.config.server.database.databasePath,
		);
		try {
			await database.db
				.update(boardTasksTable)
				.set({ ...values, updatedAt: new Date().toISOString() })
				.where(eq(boardTasksTable.id, issueId));
		} finally {
			await database.close();
		}
	}
}

function mapTaskToWorkflowIssue(
	task: typeof boardTasksTable.$inferSelect,
): WorkflowIssue {
	return {
		id: task.id,
		identifier: task.taskKey,
		title: task.title,
		description: task.content,
		url: `devos://tasks/${task.id}`,
		projectId: task.projectId ?? undefined,
		creatorId: task.creatorId,
		priority: { value: task.priority, name: `P${task.priority}` },
		labels: [],
		state: { id: task.status, name: task.status },
	};
}

function toCreatedRef(
	id: string,
	taskKey: string,
	title: string,
): CreatedLinearIssueRef {
	return {
		id,
		identifier: taskKey,
		title,
		url: `devos://tasks/${id}`,
	};
}
