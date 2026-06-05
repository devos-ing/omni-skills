import type { ServerDatabase } from "devos-db";
import { loadRunState } from "devos/features/workflow/state";
import { createChatRepository, createChatService } from "../chat";
import {
	DEFAULT_CHAT_ISSUE_PRIORITY,
	DEFAULT_CHAT_ISSUE_STATUS,
	DEFAULT_CHAT_ISSUE_TITLE,
} from "../chat/chat-defaults";
import { waitForTaskWorkflowIdle } from "../chat/chat-workflow-idle";
import type { LocalWorkspaceIdentity } from "../local-workspace";
import type { RealtimeEventPublisher } from "../realtime";
import { createTaskRepository, createTaskService } from "../tasks";
import { runTaskRequirementIntake } from "../tasks/task-chat-service";
import type { CliExecutor } from "../types/app.types";
import { ensureRealtimeLocalDefaultProject } from "./chat-route-realtime";

export function createChatRouteService(
	db: ServerDatabase["db"],
	workspacePath: string,
	workspace: LocalWorkspaceIdentity,
	cliExecutor: CliExecutor,
	realtimeEvents?: RealtimeEventPublisher,
) {
	const taskService = createTaskService(createTaskRepository(db));
	return createChatService(createChatRepository(db), {
		ensureDefaultProject: () =>
			ensureRealtimeLocalDefaultProject(
				db,
				workspacePath,
				workspace,
				realtimeEvents,
			),
		createIssue: async (input) => {
			const result = await taskService.createTask({
				content: input.content,
				creatorId: workspace.id,
				priority: DEFAULT_CHAT_ISSUE_PRIORITY,
				projectId: input.projectId,
				status: DEFAULT_CHAT_ISSUE_STATUS,
				title: input.title || DEFAULT_CHAT_ISSUE_TITLE,
			});
			if (result.status !== "ok") {
				throw new Error("Default chat issue creation failed");
			}
			realtimeEvents?.publish({ type: "issue.created", issue: result.value });
			return result.value;
		},
		getIssue: async (issueId) => {
			const result = await taskService.getTask(issueId);
			return result.status === "ok" ? result.value : null;
		},
		resolveTaskRequirement: (input) =>
			runTaskRequirementIntake(cliExecutor, input),
		getWorkflowRunState: (projectId, taskKey) =>
			loadRunState(workspacePath, projectId, taskKey),
		updateIssue: async (issueId, input) => {
			const result = await taskService.updateTask(issueId, input);
			if (result.status !== "ok") {
				throw new Error("Default chat issue update failed");
			}
			realtimeEvents?.publish({ type: "issue.updated", issue: result.value });
			return result.value;
		},
		waitForWorkflowIdle: (issueId) => waitForTaskWorkflowIdle(db, issueId),
	});
}
