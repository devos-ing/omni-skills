import type { LoadedConfig } from "devos/features/config";
import { logger, normalizeError } from "../../logger";
import {
	applyCronJobSkillOverrides,
	selectCronJobForImmediateRun,
} from "./cron-jobs";
import { runCronWorkflow } from "./cron-workflow";
import type {
	CronJobRunDependencies,
	RunCronJobOnceOptions,
} from "./cron.types";

export async function runCronJobOnce(
	config: LoadedConfig,
	options: RunCronJobOnceOptions,
	deps: CronJobRunDependencies = {},
): Promise<void> {
	const jobs = options.jobs ?? [];
	const job = selectCronJobForImmediateRun(jobs, options.jobId);
	const runWorkflow = deps.runWorkflow ?? runCronWorkflow;

	logger.info({ jobId: job.id }, "Starting one-time automation job run");
	try {
		await runWorkflow(applyCronJobSkillOverrides(config, job), job.run);
		logger.info({ jobId: job.id }, "One-time automation job run finished");
	} catch (error) {
		logger.error(
			{
				jobId: job.id,
				err: normalizeError(error),
			},
			"One-time automation job run failed",
		);
		throw error;
	}
}
