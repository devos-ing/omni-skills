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
	const prefix = workspaceBranchPrefix(slug);
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
	const usedCompactValues = new Set<number>();
	for (const row of rows) {
		const compact = parseCompactTaskKey(row.taskKey);
		if (compact?.prefix === prefix) {
			usedCompactValues.add(compact.value);
		}
		const rowSlug = row.projectId
			? projectOwners.get(row.projectId)
			: row.creatorId;
		if (rowSlug !== slug) {
			continue;
		}
		const value = parseTaskKeyNumber(row.taskKey);
		if (value > max) {
			max = value;
		}
	}
	let next = max + 1;
	while (usedCompactValues.has(next)) {
		next += 1;
	}
	return formatBoardTaskKey(slug, next);
}

export function boardTaskBranchName(taskKey: string): string | undefined {
	const compact = parseCompactTaskKey(taskKey);
	if (compact) {
		return `${compact.prefix}-${compact.value}`;
	}
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

function parseTaskKeyNumber(taskKey: string): number {
	return (
		parseCompactTaskKey(taskKey)?.value ??
		parseScopedTaskKey(taskKey)?.value ??
		0
	);
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

function parseCompactTaskKey(
	taskKey: string,
): { prefix: string; value: number } | undefined {
	const match = taskKey.match(/^([A-Z]{3})-([1-9]\d*)$/);
	if (!match) {
		return undefined;
	}
	const prefix = match[1];
	const suffix = match[2];
	if (!prefix || !suffix) {
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
	return { prefix, value: parsed };
}

function formatBoardTaskKey(slug: string, value: number): string {
	return `${workspaceBranchPrefix(slug)}-${value}`;
}

function workspaceBranchPrefix(slug: string): string {
	const letters = slug.replace(/[^a-z]/gi, "");
	const prefix = (letters || slug).slice(0, 3).toUpperCase();
	return prefix || TASK_KEY_PREFIX;
}
