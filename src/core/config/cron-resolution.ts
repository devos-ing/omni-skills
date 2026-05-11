import type {
	CronConfig,
	CronJobConfig,
	CronJobSchedule,
	CronScheduleDayOfWeek,
	DeepPartial,
	RunOptions,
} from "../types";
import {
	normalizeCronRunBoolean,
	parseOptionalPositiveIntStrict,
} from "./cron-utils";
import { normalizeOptionalValue } from "./env-normalizers";

export function resolveAutomations(
	automationsOverride: DeepPartial<CronConfig> | undefined,
	cronOverride: DeepPartial<CronConfig> | undefined,
): CronConfig {
	const jobs = automationsOverride?.jobs ?? cronOverride?.jobs;
	const fieldPath =
		automationsOverride?.jobs !== undefined ? "automations.jobs" : "cron.jobs";
	if (jobs === undefined) {
		return { jobs: buildDefaultCronJobs() };
	}
	return {
		jobs: jobs.map((job, index) => resolveCronJob(job, index, fieldPath)),
	};
}

function buildDefaultCronJobs(): CronJobConfig[] {
	return [
		{
			id: "hourly-pr-review",
			name: "Hourly PR Review",
			enabled: true,
			schedule: { frequency: "hourly", every: 1, minute: 0 },
			run: { allProjects: true, reviewOnly: true },
		},
		{
			id: "daily-codebase-maintenance",
			name: "Daily Codebase Maintenance",
			enabled: true,
			schedule: { frequency: "daily", time: "09:00" },
			run: {
				allProjects: true,
				poll: true,
				maxPollCycles: 1,
				exitWhenIdle: true,
			},
		},
	];
}

function resolveCronJob(
	job: DeepPartial<CronJobConfig>,
	index: number,
	fieldPath: string,
): CronJobConfig {
	if (!job || typeof job !== "object") {
		throw new Error(`${fieldPath}[${index}] must be an object`);
	}
	if (typeof job.id !== "string" || job.id.trim() === "") {
		throw new Error(`${fieldPath}[${index}].id is required`);
	}
	const resolvedSkills = resolveCronSkillOverrides(
		job.skills,
		index,
		fieldPath,
	);
	return {
		id: job.id.trim(),
		name:
			typeof job.name === "string" && job.name.trim()
				? job.name.trim()
				: undefined,
		enabled: job.enabled === undefined ? true : job.enabled === true,
		schedule: resolveCronSchedule(job.schedule, index, fieldPath),
		run: resolveCronRun(job.run, index, fieldPath),
		...(resolvedSkills ? { skills: resolvedSkills } : {}),
	};
}

function resolveCronSchedule(
	schedule: DeepPartial<CronJobSchedule> | undefined,
	index: number,
	fieldPath: string,
): CronJobSchedule {
	if (!schedule || typeof schedule !== "object") {
		throw new Error(`${fieldPath}[${index}].schedule is required`);
	}
	if (schedule.frequency === "minute") {
		return {
			frequency: "minute",
			every: parseOptionalPositiveIntStrict(
				schedule.every,
				`${fieldPath}[${index}].schedule.every`,
			),
		};
	}
	if (schedule.frequency === "hourly") {
		return {
			frequency: "hourly",
			every: parseOptionalPositiveIntStrict(
				schedule.every,
				`${fieldPath}[${index}].schedule.every`,
			),
			minute: parseOptionalPositiveIntStrict(
				schedule.minute,
				`${fieldPath}[${index}].schedule.minute`,
				true,
			),
		};
	}
	if (schedule.frequency === "daily") {
		if (typeof schedule.time !== "string") {
			throw new Error(`${fieldPath}[${index}].schedule.time is required`);
		}
		return { frequency: "daily", time: schedule.time };
	}
	if (schedule.frequency === "weekly") {
		if (typeof schedule.time !== "string") {
			throw new Error(`${fieldPath}[${index}].schedule.time is required`);
		}
		if (typeof schedule.dayOfWeek !== "string") {
			throw new Error(`${fieldPath}[${index}].schedule.dayOfWeek is required`);
		}
		return {
			frequency: "weekly",
			dayOfWeek: schedule.dayOfWeek as CronScheduleDayOfWeek,
			time: schedule.time,
		};
	}
	throw new Error(
		`${fieldPath}[${index}].schedule.frequency must be one of minute, hourly, daily, weekly`,
	);
}

function resolveCronRun(
	run: DeepPartial<RunOptions> | undefined,
	index: number,
	fieldPath: string,
): RunOptions {
	if (!run || typeof run !== "object") {
		return {};
	}
	const projectId =
		typeof run.projectId === "string"
			? normalizeOptionalValue(run.projectId)
			: undefined;
	const issueArg =
		typeof run.issueArg === "string"
			? normalizeOptionalValue(run.issueArg)
			: undefined;
	const pollIntervalMs = parseOptionalPositiveIntStrict(
		run.pollIntervalMs,
		`${fieldPath}[${index}].run.pollIntervalMs`,
	);
	const concurrency = parseOptionalPositiveIntStrict(
		run.concurrency,
		`${fieldPath}[${index}].run.concurrency`,
	);
	const maxPollCycles = parseOptionalPositiveIntStrict(
		run.maxPollCycles,
		`${fieldPath}[${index}].run.maxPollCycles`,
	);
	return {
		issueArg,
		projectId,
		allProjects: normalizeCronRunBoolean(
			run.allProjects,
			`${fieldPath}[${index}].run.allProjects must be a boolean`,
		),
		reviewOnly: normalizeCronRunBoolean(
			run.reviewOnly,
			`${fieldPath}[${index}].run.reviewOnly must be a boolean`,
		),
		poll: normalizeCronRunBoolean(
			run.poll,
			`${fieldPath}[${index}].run.poll must be a boolean`,
		),
		concurrency,
		pollIntervalMs,
		maxPollCycles,
		exitWhenIdle: normalizeCronRunBoolean(
			run.exitWhenIdle,
			`${fieldPath}[${index}].run.exitWhenIdle must be a boolean`,
		),
	};
}

function resolveCronSkillOverrides(
	skills: unknown,
	index: number,
	fieldPath: string,
): CronJobConfig["skills"] {
	if (skills === undefined) {
		return undefined;
	}
	if (!skills || typeof skills !== "object") {
		throw new Error(`${fieldPath}[${index}].skills must be an object`);
	}
	const parsed = skills as {
		plan?: unknown;
		implement?: unknown;
		reviewTest?: unknown;
	};
	return {
		plan: normalizeSkillOverridePath(
			parsed.plan,
			`${fieldPath}[${index}].skills.plan`,
		),
		implement: normalizeSkillOverridePath(
			parsed.implement,
			`${fieldPath}[${index}].skills.implement`,
		),
		reviewTest: normalizeSkillOverridePath(
			parsed.reviewTest,
			`${fieldPath}[${index}].skills.reviewTest`,
		),
	};
}

function normalizeSkillOverridePath(
	input: unknown,
	field: string,
): string | undefined {
	if (input === undefined) {
		return undefined;
	}
	if (typeof input !== "string") {
		throw new Error(`${field} must be a string`);
	}
	return normalizeOptionalValue(input);
}
