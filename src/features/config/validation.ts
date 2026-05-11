import type {
	CronConfig,
	CronJobSchedule,
	CronScheduleDayOfWeek,
	PollingConfig,
	ResolvedNotificationConfig,
	ResolvedProjectConfig,
	RunOptions,
} from "../../core/types";

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

export function validateCron(cron: CronConfig): void {
	const seen = new Set<string>();
	for (const job of cron.jobs) {
		if (seen.has(job.id)) {
			throw new Error(`Duplicate cron job id: ${job.id}`);
		}
		seen.add(job.id);
		validateCronSchedule(job.id, job.schedule);
		validateCronRun(job.id, job.run);
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

function validateCronSchedule(jobId: string, schedule: CronJobSchedule): void {
	if (schedule.frequency === "minute") {
		const every = schedule.every ?? 1;
		if (!Number.isInteger(every) || every <= 0 || every > 59) {
			throw new Error(
				`Cron job '${jobId}' minute schedule.every must be between 1 and 59`,
			);
		}
		return;
	}
	if (schedule.frequency === "hourly") {
		const every = schedule.every ?? 1;
		const minute = schedule.minute ?? 0;
		if (!Number.isInteger(every) || every <= 0 || every > 24) {
			throw new Error(
				`Cron job '${jobId}' hourly schedule.every must be between 1 and 24`,
			);
		}
		if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
			throw new Error(
				`Cron job '${jobId}' hourly schedule.minute must be between 0 and 59`,
			);
		}
		return;
	}
	if (schedule.frequency === "daily") {
		assertValidTime(jobId, schedule.time);
		return;
	}
	assertValidDayOfWeek(jobId, schedule.dayOfWeek);
	assertValidTime(jobId, schedule.time);
}

function validateCronRun(jobId: string, run: RunOptions): void {
	if (run.projectId && run.allProjects) {
		throw new Error(
			`Cron job '${jobId}' run cannot use projectId with allProjects`,
		);
	}
	if (
		run.concurrency !== undefined &&
		(!Number.isInteger(run.concurrency) || run.concurrency <= 0)
	) {
		throw new Error(
			`Cron job '${jobId}' run.concurrency must be a positive integer`,
		);
	}
	if (run.reviewOnly && run.issueArg) {
		throw new Error(
			`Cron job '${jobId}' run cannot use issueArg with reviewOnly`,
		);
	}
}

function assertValidTime(jobId: string, time: string): void {
	if (!/^\d{2}:\d{2}$/.test(time)) {
		throw new Error(`Cron job '${jobId}' time must be in HH:mm 24-hour format`);
	}
	const [hourRaw, minuteRaw] = time.split(":");
	const hour = Number(hourRaw);
	const minute = Number(minuteRaw);
	if (
		!Number.isInteger(hour) ||
		!Number.isInteger(minute) ||
		hour < 0 ||
		hour > 23 ||
		minute < 0 ||
		minute > 59
	) {
		throw new Error(`Cron job '${jobId}' time must be in HH:mm 24-hour format`);
	}
}

function assertValidDayOfWeek(
	jobId: string,
	dayOfWeek: CronScheduleDayOfWeek,
): void {
	const allowed = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
	if (!allowed.includes(dayOfWeek)) {
		throw new Error(
			`Cron job '${jobId}' weekly dayOfWeek must be one of: ${allowed.join(", ")}`,
		);
	}
}
