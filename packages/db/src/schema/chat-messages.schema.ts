import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { chatSessionsTable } from "./chat-sessions.schema";

export const chatMessagesTable = pgTable("chat_messages", {
	id: text("id").primaryKey(),
	sessionId: text("session_id")
		.notNull()
		.references(() => chatSessionsTable.id, { onDelete: "cascade" }),
	role: text("role").notNull(),
	kind: text("kind").notNull(),
	content: text("content").notNull(),
	taskId: text("task_id"),
	commandAction: text("command_action"),
	metadata: text("metadata"),
	createdAt: timestamp("created_at", { mode: "string" }).notNull(),
});
