import { desc, eq } from "devos-db";
import type { ServerDatabase } from "devos-db";
import { taskExecutionLogsTable } from "devos-db";

const WORKFLOW_IDLE_POLL_INTERVAL_MS = 1000;

export async function waitForTaskWorkflowIdle(
	db: ServerDatabase["db"],
	taskId: string,
): Promise<void> {
	while ((await readLatestTaskExecutionStatus(db, taskId)) === "running") {
		await sleep(WORKFLOW_IDLE_POLL_INTERVAL_MS);
	}
}

export async function readLatestTaskExecutionStatus(
	db: ServerDatabase["db"],
	taskId: string,
): Promise<string | null> {
	const [latest] = await db
		.select({ status: taskExecutionLogsTable.status })
		.from(taskExecutionLogsTable)
		.where(eq(taskExecutionLogsTable.taskId, taskId))
		.orderBy(desc(taskExecutionLogsTable.startedAt))
		.limit(1);
	return latest?.status ?? null;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
