import type { ServerDatabase } from "./database.types";
import { boardTasksTable } from "./schema/board-tasks.schema";
import type { BoardTaskKeyScope } from "./task-keys.types";

const TASK_KEY_PREFIX = "TASK";

export async function generateBoardTaskKey(
	db: ServerDatabase["db"],
	scope: BoardTaskKeyScope,
): Promise<string> {
	const slug = resolveTaskKeySlug(scope);
	const rows = await db
		.select({ taskKey: boardTasksTable.taskKey })
		.from(boardTasksTable);
	let max = 0;
	for (const row of rows) {
		const value = parseTaskKeyNumber(row.taskKey, slug);
		if (value > max) {
			max = value;
		}
	}
	return formatBoardTaskKey(slug, max + 1);
}

function resolveTaskKeySlug(scope: BoardTaskKeyScope): string {
	return scope.projectId?.trim() || scope.creatorId.trim();
}

function parseTaskKeyNumber(taskKey: string, slug: string): number {
	const prefix = `${TASK_KEY_PREFIX}(${slug})-`;
	if (!taskKey.startsWith(prefix)) {
		return 0;
	}
	const suffix = taskKey.slice(prefix.length);
	const parsed = Number(suffix);
	return Number.isInteger(parsed) && parsed > 0 && String(parsed) === suffix
		? parsed
		: 0;
}

function formatBoardTaskKey(slug: string, value: number): string {
	return `${TASK_KEY_PREFIX}(${slug})-${value}`;
}
