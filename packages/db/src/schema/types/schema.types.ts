import type {
	agentsTable,
	boardProjectsTable,
	boardTasksTable,
	chatMessagesTable,
	chatSessionsTable,
	commandHistoryTable,
	inboxMessagesTable,
	jobsTable,
	pollingEventsTable,
	pollingStatusTable,
	projectBoardsTable,
	projectCronJobsTable,
	skillsTable,
	taskAssigneesTable,
	taskCommentsTable,
	taskExecutionLogsTable,
	taskExecutionStepsTable,
	taskPullRequestsTable,
	taskTagsTable,
	tokenUsageTable,
} from "..";

export type AgentRow = typeof agentsTable.$inferSelect;
export type NewAgentRow = typeof agentsTable.$inferInsert;
export type BoardProjectRow = typeof boardProjectsTable.$inferSelect;
export type NewBoardProjectRow = typeof boardProjectsTable.$inferInsert;
export type BoardTaskRow = typeof boardTasksTable.$inferSelect;
export type NewBoardTaskRow = typeof boardTasksTable.$inferInsert;
export type ChatMessageRow = typeof chatMessagesTable.$inferSelect;
export type NewChatMessageRow = typeof chatMessagesTable.$inferInsert;
export type ChatSessionRow = typeof chatSessionsTable.$inferSelect;
export type NewChatSessionRow = typeof chatSessionsTable.$inferInsert;
export type CommandHistoryRow = typeof commandHistoryTable.$inferSelect;
export type NewCommandHistoryRow = typeof commandHistoryTable.$inferInsert;
export type InboxMessageRow = typeof inboxMessagesTable.$inferSelect;
export type NewInboxMessageRow = typeof inboxMessagesTable.$inferInsert;
export type JobRow = typeof jobsTable.$inferSelect;
export type NewJobRow = typeof jobsTable.$inferInsert;
export type PollingEventRow = typeof pollingEventsTable.$inferSelect;
export type NewPollingEventRow = typeof pollingEventsTable.$inferInsert;
export type PollingStatusRow = typeof pollingStatusTable.$inferSelect;
export type NewPollingStatusRow = typeof pollingStatusTable.$inferInsert;
export type ProjectBoardRow = typeof projectBoardsTable.$inferSelect;
export type NewProjectBoardRow = typeof projectBoardsTable.$inferInsert;
export type ProjectCronJobRow = typeof projectCronJobsTable.$inferSelect;
export type NewProjectCronJobRow = typeof projectCronJobsTable.$inferInsert;
export type SkillRow = typeof skillsTable.$inferSelect;
export type NewSkillRow = typeof skillsTable.$inferInsert;
export type TaskAssigneeRow = typeof taskAssigneesTable.$inferSelect;
export type NewTaskAssigneeRow = typeof taskAssigneesTable.$inferInsert;
export type TaskCommentRow = typeof taskCommentsTable.$inferSelect;
export type NewTaskCommentRow = typeof taskCommentsTable.$inferInsert;
export type TaskExecutionLogRow = typeof taskExecutionLogsTable.$inferSelect;
export type NewTaskExecutionLogRow = typeof taskExecutionLogsTable.$inferInsert;
export type TaskExecutionStepRow = typeof taskExecutionStepsTable.$inferSelect;
export type NewTaskExecutionStepRow =
	typeof taskExecutionStepsTable.$inferInsert;
export type TaskPullRequestRow = typeof taskPullRequestsTable.$inferSelect;
export type NewTaskPullRequestRow = typeof taskPullRequestsTable.$inferInsert;
export type TaskTagRow = typeof taskTagsTable.$inferSelect;
export type NewTaskTagRow = typeof taskTagsTable.$inferInsert;
export type TokenUsageRow = typeof tokenUsageTable.$inferSelect;
export type NewTokenUsageRow = typeof tokenUsageTable.$inferInsert;
