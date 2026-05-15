import { boardTasksTable } from "./board-tasks.schema";
import type { ServerDatabase } from "./database.types";

const TASK_KEY_PREFIX = "TASK";
const TASK_KEY_WIDTH = 6;

export async function generateBoardTaskKey(
	db: ServerDatabase["db"],
): Promise<string> {
	const rows = await db
		.select({ taskKey: boardTasksTable.taskKey })
		.from(boardTasksTable);
	let max = 0;
	for (const row of rows) {
		const value = parseTaskKeyNumber(row.taskKey);
		if (value > max) {
			max = value;
		}
	}
	return formatBoardTaskKey(max + 1);
}

function parseTaskKeyNumber(taskKey: string): number {
	const prefix = `${TASK_KEY_PREFIX}-`;
	if (!taskKey.startsWith(prefix)) {
		return 0;
	}
	const parsed = Number(taskKey.slice(prefix.length));
	return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function formatBoardTaskKey(value: number): string {
	return `${TASK_KEY_PREFIX}-${String(value).padStart(TASK_KEY_WIDTH, "0")}`;
}
