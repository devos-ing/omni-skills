import { eq } from "drizzle-orm";
import { boardProjectsTable } from "./schema/board-projects.schema";
import { boardTasksTable } from "./schema/board-tasks.schema";
import type { ServerDatabase } from "./types/database.types";
import type { BoardTaskKeyScope } from "./types/task-keys.types";

const TASK_KEY_PREFIX = "TASK";

export async function generateBoardTaskKey(
	db: ServerDatabase["db"],
	scope: BoardTaskKeyScope,
): Promise<string> {
	const slug = await resolveTaskKeySlug(db, scope);
	const rows = await db
		.select({
			creatorId: boardTasksTable.creatorId,
			projectId: boardTasksTable.projectId,
			taskKey: boardTasksTable.taskKey,
		})
		.from(boardTasksTable);
	const projects = await db
		.select({ id: boardProjectsTable.id, ownerId: boardProjectsTable.ownerId })
		.from(boardProjectsTable);
	const projectOwners = new Map(
		projects.map((project) => [project.id, project.ownerId]),
	);
	let max = 0;
	for (const row of rows) {
		const rowSlug = row.projectId
			? projectOwners.get(row.projectId)
			: row.creatorId;
		if (rowSlug !== slug) {
			continue;
		}
		const value = parseScopedTaskKeyNumber(row.taskKey);
		if (value > max) {
			max = value;
		}
	}
	return formatBoardTaskKey(slug, max + 1);
}

export function boardTaskBranchName(taskKey: string): string | undefined {
	const parsed = parseScopedTaskKey(taskKey);
	if (!parsed) {
		return undefined;
	}
	return `${workspaceBranchPrefix(parsed.slug)}-${parsed.value}`;
}

export function boardTaskKeyScope(taskKey: string): string | undefined {
	return parseScopedTaskKey(taskKey)?.slug;
}

async function resolveTaskKeySlug(
	db: ServerDatabase["db"],
	scope: BoardTaskKeyScope,
): Promise<string> {
	if (!scope.projectId?.trim()) {
		return scope.creatorId.trim();
	}
	const [project] = await db
		.select({ ownerId: boardProjectsTable.ownerId })
		.from(boardProjectsTable)
		.where(eq(boardProjectsTable.id, scope.projectId.trim()));
	return project?.ownerId ?? scope.projectId.trim();
}

function parseScopedTaskKeyNumber(taskKey: string): number {
	return parseScopedTaskKey(taskKey)?.value ?? 0;
}

function parseScopedTaskKey(
	taskKey: string,
): { slug: string; value: number } | undefined {
	const match = taskKey.match(/^TASK\(([^)]+)\)-([1-9]\d*)$/);
	if (!match) {
		return undefined;
	}
	const slug = match[1];
	const suffix = match[2];
	if (!slug || !suffix) {
		return undefined;
	}
	const parsed = Number(suffix);
	if (
		!Number.isSafeInteger(parsed) ||
		parsed <= 0 ||
		String(parsed) !== suffix
	) {
		return undefined;
	}
	return { slug, value: parsed };
}

function formatBoardTaskKey(slug: string, value: number): string {
	return `${TASK_KEY_PREFIX}(${slug})-${value}`;
}

function workspaceBranchPrefix(slug: string): string {
	const letters = slug.replace(/[^a-z]/gi, "");
	const prefix = (letters || slug).slice(0, 3).toUpperCase();
	return prefix || TASK_KEY_PREFIX;
}
