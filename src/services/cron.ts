import type { LoadedConfig } from "../core/config";
import type {
	CronJobConfig,
	CronJobSchedule,
	CronScheduleDayOfWeek,
	RunOptions,
} from "../core/types";
import { runWorkflow, sleep } from "../core/workflow";
import { logger, normalizeError } from "../utils/logger";
import { applyCronJobSkillOverrides, selectCronJobs } from "./cron-jobs";
import type {
	CronCycleDeps,
	CronCycleState,
	CronRuntimeState,
	CronSchedulerDependencies,
	RunCronOptions,
} from "./cron.types";

export { runCronJobOnce, selectCronJobs } from "./cron-jobs";
export type {
	CronJobRunDependencies,
	CronRuntimeState,
	CronSchedulerDependencies,
	RunCronJobOnceOptions,
	RunCronOptions,
} from "./cron.types";

const SCHEDULER_MIN_SLEEP_MS = 250;
const SCHEDULER_MAX_SLEEP_MS = 60000;

export async function runCronScheduler(
	config: LoadedConfig,
	options: RunCronOptions,
	deps: CronSchedulerDependencies = {},
): Promise<never> {
	const jobs = selectCronJobs(config, options.jobId);
	const now = deps.now ?? (() => new Date());
	const sleepFn = deps.sleep ?? sleep;
	const runWorkflowFn = deps.runWorkflow ?? runWorkflow;

	if (jobs.length === 0) {
		throw new Error("No enabled automation jobs found");
	}

	const nextRunAtByJobId = new Map<string, number>();
	const activeJobIds = new Set<string>();
	for (const job of jobs) {
		nextRunAtByJobId.set(
			job.id,
			computeNextCronRunAt(job.schedule, now()).getTime(),
		);
	}

	logger.info({ jobIds: jobs.map((job) => job.id) }, "Cron scheduler started");

	while (true) {
		await runCronSchedulerCycle(
			config,
			jobs,
			{ nextRunAtByJobId, activeJobIds },
			{
				now,
				runWorkflow: runWorkflowFn,
			},
		);
		const sleepMs = computeSchedulerSleepMs(nextRunAtByJobId, now().getTime());
		await sleepFn(sleepMs);
	}
}

export async function runCronSchedulerCycle(
	config: LoadedConfig,
	jobs: CronJobConfig[],
	state: CronCycleState,
	deps: CronCycleDeps,
): Promise<void> {
	const currentMs = deps.now().getTime();

	for (const job of jobs) {
		const nextRunAtMs = state.nextRunAtByJobId.get(job.id);
		if (nextRunAtMs === undefined || currentMs < nextRunAtMs) {
			continue;
		}

		if (state.activeJobIds.has(job.id)) {
			const skippedTo = computeNextCronRunAt(
				job.schedule,
				deps.now(),
			).getTime();
			state.nextRunAtByJobId.set(job.id, skippedTo);
			logger.warn(
				{
					jobId: job.id,
					skippedAt: new Date(currentMs).toISOString(),
					nextRunAt: new Date(skippedTo).toISOString(),
				},
				"Skipping overlapping cron run",
			);
			continue;
		}

		const scheduledFor = nextRunAtMs;
		const subsequentRunAtMs = computeNextCronRunAt(
			job.schedule,
			new Date(scheduledFor),
		).getTime();
		state.nextRunAtByJobId.set(job.id, subsequentRunAtMs);
		state.activeJobIds.add(job.id);
		logger.info(
			{
				jobId: job.id,
				scheduledFor: new Date(scheduledFor).toISOString(),
				nextRunAt: new Date(subsequentRunAtMs).toISOString(),
			},
			"Starting cron job run",
		);

		void deps
			.runWorkflow(applyCronJobSkillOverrides(config, job), job.run)
			.catch((error) => {
				logger.error(
					{
						jobId: job.id,
						err: normalizeError(error),
					},
					"Automation job run failed",
				);
			})
			.finally(() => {
				state.activeJobIds.delete(job.id);
				logger.info({ jobId: job.id }, "Automation job run finished");
			});
	}
}

export function computeNextCronRunAt(
	schedule: CronJobSchedule,
	after: Date,
): Date {
	let candidate = alignToMinute(after).getTime() + 60000;
	while (true) {
		const current = new Date(candidate);
		if (matchesCronSchedule(schedule, current)) {
			return current;
		}
		candidate += 60000;
	}
}

export function matchesCronSchedule(
	schedule: CronJobSchedule,
	candidate: Date,
): boolean {
	if (schedule.frequency === "minute") {
		const every = schedule.every ?? 1;
		return candidate.getMinutes() % every === 0;
	}
	if (schedule.frequency === "hourly") {
		const every = schedule.every ?? 1;
		const minute = schedule.minute ?? 0;
		return (
			candidate.getMinutes() === minute && candidate.getHours() % every === 0
		);
	}
	if (schedule.frequency === "daily") {
		const { hour, minute } = parseTime(schedule.time);
		return candidate.getHours() === hour && candidate.getMinutes() === minute;
	}
	const { hour, minute } = parseTime(schedule.time);
	return (
		candidate.getDay() === toJsDayOfWeek(schedule.dayOfWeek) &&
		candidate.getHours() === hour &&
		candidate.getMinutes() === minute
	);
}

function computeSchedulerSleepMs(
	nextRunAtByJobId: Map<string, number>,
	nowMs: number,
): number {
	const nextAt = Math.min(...nextRunAtByJobId.values());
	const untilNext = nextAt - nowMs;
	if (!Number.isFinite(untilNext) || untilNext <= SCHEDULER_MIN_SLEEP_MS) {
		return SCHEDULER_MIN_SLEEP_MS;
	}
	return Math.min(SCHEDULER_MAX_SLEEP_MS, untilNext);
}

function alignToMinute(input: Date): Date {
	const rounded = new Date(input.getTime());
	rounded.setSeconds(0, 0);
	return rounded;
}

function parseTime(time: string): { hour: number; minute: number } {
	const [hourRaw, minuteRaw] = time.split(":");
	return {
		hour: Number(hourRaw),
		minute: Number(minuteRaw),
	};
}

function toJsDayOfWeek(day: CronScheduleDayOfWeek): number {
	const map: Record<CronScheduleDayOfWeek, number> = {
		sun: 0,
		mon: 1,
		tue: 2,
		wed: 3,
		thu: 4,
		fri: 5,
		sat: 6,
	};
	return map[day];
}
