import { and, asc, desc, eq } from "devos-db";
import type { ServerDatabase } from "devos-db";
import { chatMessagesTable, chatSessionsTable } from "devos-db";
import type { NewChatMessageRow, NewChatSessionRow } from "devos-db";
import type { ChatRepository } from "./types/chat.types";

export function createChatRepository(db: ServerDatabase["db"]): ChatRepository {
	return {
		async listSessions(workspaceId) {
			return db
				.select()
				.from(chatSessionsTable)
				.where(
					and(
						eq(chatSessionsTable.workspaceId, workspaceId),
						eq(chatSessionsTable.archived, false),
					),
				)
				.orderBy(desc(chatSessionsTable.updatedAt));
		},
		async getSession(id) {
			const [session] = await db
				.select()
				.from(chatSessionsTable)
				.where(eq(chatSessionsTable.id, id));
			return session ?? null;
		},
		async getSessionByTaskId(taskId) {
			const [session] = await db
				.select()
				.from(chatSessionsTable)
				.where(
					and(
						eq(chatSessionsTable.taskId, taskId),
						eq(chatSessionsTable.archived, false),
					),
				)
				.orderBy(desc(chatSessionsTable.updatedAt));
			return session ?? null;
		},
		async createSession(input: NewChatSessionRow) {
			const [created] = await db
				.insert(chatSessionsTable)
				.values(input)
				.returning();
			if (!created) {
				throw new Error("Chat session creation failed");
			}
			return created;
		},
		async updateSession(id, input: Partial<NewChatSessionRow>) {
			const [updated] = await db
				.update(chatSessionsTable)
				.set(input)
				.where(eq(chatSessionsTable.id, id))
				.returning();
			return updated ?? null;
		},
		async listMessages(sessionId) {
			return db
				.select()
				.from(chatMessagesTable)
				.where(eq(chatMessagesTable.sessionId, sessionId))
				.orderBy(asc(chatMessagesTable.createdAt));
		},
		async addMessage(_sessionId, message: NewChatMessageRow) {
			const [created] = await db
				.insert(chatMessagesTable)
				.values(message)
				.returning();
			if (!created) {
				throw new Error("Chat message creation failed");
			}
			return created;
		},
	};
}
