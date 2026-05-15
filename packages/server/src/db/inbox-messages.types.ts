import type { inboxMessagesTable } from "./inbox-messages.schema";

export type InboxMessageRow = typeof inboxMessagesTable.$inferSelect;
export type NewInboxMessageRow = typeof inboxMessagesTable.$inferInsert;
