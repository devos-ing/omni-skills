import type { StatusCommand } from "../../../args";
import { formatWorkflowStageDisplay } from "../../../utils/status";
import { type LoadedConfig, getProjectById } from "../../config";
import { loadRunState, normalizeIssueKey } from "../../workflow/state";

export async function handleStatusCommand(
	config: LoadedConfig,
	command: StatusCommand,
): Promise<void> {
	const project = getProjectById(config, command.projectId);
	if (!project) {
		throw new Error(`Project '${command.projectId}' not found`);
	}
	const key = normalizeIssueKey(command.issueKey);
	const state = await loadRunState(project.workspacePath, project.id, key);
	if (!state) {
		process.stdout.write(
			`No run state found for ${key} in project ${project.id}\n`,
		);
		return;
	}
	const statusDisplay = {
		...state,
		stageDisplay: formatWorkflowStageDisplay(state.stage),
	};
	process.stdout.write(`${JSON.stringify(statusDisplay, null, 2)}\n`);
}
