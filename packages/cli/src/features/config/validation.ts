import type {
	PollingConfig,
	ResolvedNotificationConfig,
	ResolvedProjectConfig,
} from "../../features/types";

export function validateProjects(projects: ResolvedProjectConfig[]): void {
	if (projects.length === 0) {
		throw new Error("At least one project configuration is required");
	}
	const seen = new Set<string>();
	for (const project of projects) {
		if (!project.id) {
			throw new Error("Project id cannot be empty");
		}
		if (seen.has(project.id)) {
			throw new Error(`Duplicate project id: ${project.id}`);
		}
		seen.add(project.id);
		validateProject(project);
	}
}

export function validatePolling(polling: PollingConfig): void {
	if (!Number.isInteger(polling.intervalMs) || polling.intervalMs <= 0) {
		throw new Error("Polling interval must be a positive integer");
	}
	if (
		polling.maxCycles !== undefined &&
		(!Number.isInteger(polling.maxCycles) || polling.maxCycles <= 0)
	) {
		throw new Error("Polling max cycles must be a positive integer");
	}
	if (
		!Number.isInteger(polling.staleRunTimeoutMs) ||
		polling.staleRunTimeoutMs <= 0
	) {
		throw new Error("Polling stale run timeout must be a positive integer");
	}
}

export function validateNotifications(
	notifications: ResolvedNotificationConfig,
): void {
	const { email } = notifications;
	if (!email.enabled) {
		return;
	}
	if (!email.resendApiKey) {
		throw new Error(
			"notifications.email.resendApiKey (or RESEND_API_KEY) is required when email notifications are enabled",
		);
	}
	if (!email.from) {
		throw new Error(
			"notifications.email.from (or RESEND_FROM) is required when email notifications are enabled",
		);
	}
	if (email.to.length === 0) {
		throw new Error(
			"notifications.email.to (or RESEND_TO) must include at least one recipient when email notifications are enabled",
		);
	}
}

function validateProject(project: ResolvedProjectConfig): void {
	if (!project.linear.apiKey) {
		throw new Error(`LINEAR_API_KEY is required for project '${project.id}'`);
	}
	if (!project.executionPath) {
		throw new Error(`Execution path is required for project '${project.id}'`);
	}
	if (project.codex.docker?.enabled && !project.codex.docker.image) {
		throw new Error(
			`Codex Docker image is required for project '${project.id}' when codex.docker.enabled is true`,
		);
	}
	if (
		!Number.isInteger(project.workflow.issueConcurrency) ||
		project.workflow.issueConcurrency <= 0
	) {
		throw new Error(
			`Workflow issue concurrency must be a positive integer for project '${project.id}'`,
		);
	}
	if (
		project.workflow.isolatedWorktrees?.root !== undefined &&
		project.workflow.isolatedWorktrees.root.trim() === ""
	) {
		throw new Error(
			`Workflow isolated worktrees root cannot be empty for project '${project.id}'`,
		);
	}
	const requiredStateIds = Object.entries(project.linear.statusMap).filter(
		([, value]) => !value,
	);
	if (requiredStateIds.length > 0) {
		throw new Error(
			`Missing Linear status ids for project '${project.id}': ${requiredStateIds
				.map(([key]) => key)
				.join(", ")}`,
		);
	}
}
