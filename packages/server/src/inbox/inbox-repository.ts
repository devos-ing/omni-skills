import { and, desc, eq } from "drizzle-orm";
import type { InboxMessageRow, ServerDatabase } from "../db";
import { inboxMessagesTable as table } from "../db";
import type {
	CreateInboxMessageInput,
	InboxMessageMetadata,
	InboxMessageRecord,
	InboxMessageScope,
	InboxRepository,
} from "./inbox.types";

function normalizeTimestamp(value: string | Date): string {
	if (value instanceof Date) {
		return value.toISOString();
	}
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function parseMetadata(value: string | null): InboxMessageMetadata | null {
	if (!value) {
		return null;
	}
	try {
		const parsed = JSON.parse(value);
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			!Array.isArray(parsed)
		) {
			return parsed as InboxMessageMetadata;
		}
		return null;
	} catch {
		return null;
	}
}

function mapInboxMessage(row: InboxMessageRow): InboxMessageRecord {
	return {
		id: row.id,
		workspaceId: row.workspaceId,
		userId: row.userId,
		runId: row.runId,
		source: row.source,
		kind: row.kind,
		body: row.body,
		taskId: row.taskId,
		agentId: row.agentId,
		metadata: parseMetadata(row.metadata),
		createdAt: normalizeTimestamp(row.createdAt),
	};
}

function stringifyMetadata(
	value: InboxMessageMetadata | null | undefined,
): string | null {
	if (value === undefined || value === null) {
		return null;
	}
	return JSON.stringify(value);
}

export function createInboxRepository(
	db: ServerDatabase["db"],
): InboxRepository {
	return {
		async createInboxMessage(input) {
			const [created] = await db
				.insert(table)
				.values({
					id: crypto.randomUUID(),
					workspaceId: input.workspaceId,
					userId: input.userId,
					runId: input.runId,
					source: input.source,
					kind: input.kind,
					body: input.body,
					taskId: input.taskId ?? null,
					agentId: input.agentId ?? null,
					metadata: stringifyMetadata(input.metadata),
					createdAt: input.createdAt ?? new Date().toISOString(),
				})
				.returning();
			return mapInboxMessage(created);
		},
		async listInboxMessages(scope: InboxMessageScope) {
			const rows = await db
				.select()
				.from(table)
				.where(
					and(
						eq(table.workspaceId, scope.workspaceId),
						eq(table.userId, scope.userId),
						eq(table.runId, scope.runId),
					),
				)
				.orderBy(desc(table.createdAt), desc(table.id));
			return rows.map(mapInboxMessage);
		},
	};
}
