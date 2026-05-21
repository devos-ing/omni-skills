import { sleep } from "bun";
import type { LoadedConfig } from "devos/features/config";
import { logger, normalizeError } from "../../logger";
import { applyCronJobSkillOverrides, selectCronJobs } from "./cron-jobs";
import { computeNextCronRunAt, computeSchedulerSleepMs } from "./cron-schedule";
import { runCronWorkflow } from "./cron-workflow";
import type {
	CronCycleDeps,
	CronCycleState,
	CronJobConfig,
	CronSchedulerDependencies,
	RunCronOptions,
} from "./cron.types";

export async function runCronScheduler(
	config: LoadedConfig,
	options: RunCronOptions,
	deps: CronSchedulerDependencies = {},
): Promise<never> {
	const jobs = selectCronJobs(options.jobs ?? [], options.jobId);
	const now = deps.now ?? (() => new Date());
	const sleepFn = deps.sleep ?? sleep;
	const runWorkflow = deps.runWorkflow ?? runCronWorkflow;

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
				runWorkflow,
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
