import type { InboxMessageScope } from "./types/client.types";

export const serverStateQueryKeys = {
	tokenUsage: ["server-state", "token-usage"] as const,
	jobs: ["server-state", "jobs"] as const,
	agents: ["server-state", "agents"] as const,
	skills: ["server-state", "skills"] as const,
	currentWorkspace: ["server-state", "current-workspace"] as const,
	workspaceEnvironment: (projectId: string | null) =>
		["server-state", "workspace-environment", projectId ?? "local"] as const,
	commandHistory: ["server-state", "command-history"] as const,
	workflowComputers: ["server-state", "workflow-computers"] as const,
	modelSettings: ["server-state", "model-settings"] as const,
	chatSessions: (workspaceId: string) =>
		["server-state", "chat-sessions", workspaceId] as const,
	chatMessages: (sessionId: string) =>
		["server-state", "chat-messages", sessionId] as const,
	pollingStatus: ["server-state", "polling-status"] as const,
	boardTasks: ["server-state", "board-tasks"] as const,
	boardTask: (taskId: string) =>
		["server-state", "board-task", taskId] as const,
	taskActivity: (taskId: string) =>
		["server-state", "task-activity", taskId] as const,
	workspaceProjects: (workspaceId: string) =>
		["server-state", "workspace-projects", workspaceId] as const,
	projectBoards: ["server-state", "project-board"] as const,
	projectBoard: (workspaceId: string, projectId: string) =>
		["server-state", "project-board", workspaceId, projectId] as const,
	inboxMessages: (scope: InboxMessageScope) =>
		[
			"server-state",
			"inbox-messages",
			scope.workspaceId,
			scope.userId,
			scope.runId,
		] as const,
};
