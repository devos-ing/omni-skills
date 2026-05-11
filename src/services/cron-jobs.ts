import path from "node:path";
import type { LoadedConfig } from "../core/config";
import type { CronJobConfig, RunOptions } from "../core/types";
import { runWorkflow } from "../core/workflow";
import { logger, normalizeError } from "../utils/logger";
import type {
	CronJobRunDependencies,
	RunCronJobOnceOptions,
} from "./cron.types";

export async function runCronJobOnce(
	config: LoadedConfig,
	options: RunCronJobOnceOptions,
	deps: CronJobRunDependencies = {},
): Promise<void> {
	const job = selectCronJobForImmediateRun(config, options.jobId);
	const runWorkflowFn = deps.runWorkflow ?? runWorkflow;

	logger.info({ jobId: job.id }, "Starting one-time automation job run");
	try {
		await runWorkflowFn(applyCronJobSkillOverrides(config, job), job.run);
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

export function selectCronJobs(
	config: LoadedConfig,
	jobId: string | undefined,
): CronJobConfig[] {
	const jobs = enabledCronJobs(config);
	if (!jobId) {
		return jobs;
	}
	const selected = jobs.find((job) => job.id === jobId);
	if (!selected) {
		throw new Error(`Automation job '${jobId}' not found or disabled`);
	}
	return [selected];
}

export function applyCronJobSkillOverrides(
	config: LoadedConfig,
	job: CronJobConfig,
): LoadedConfig {
	const overrides = job.skills;
	if (!overrides) {
		return config;
	}

	const projects = config.projects.map((project) => ({
		...project,
		skills: {
			...project.skills,
			plan: resolveJobSkillPath(
				project.skills.root,
				overrides.plan,
				project.skills.plan,
			),
			implement: resolveJobSkillPath(
				project.skills.root,
				overrides.implement,
				project.skills.implement,
			),
			reviewTest: resolveJobSkillPath(
				project.skills.root,
				overrides.reviewTest,
				project.skills.reviewTest,
			),
		},
	}));

	return {
		...config,
		projects,
	};
}

function selectCronJobForImmediateRun(
	config: LoadedConfig,
	jobId: string | undefined,
): CronJobConfig {
	const jobs = selectCronJobs(config, jobId);
	const selected = jobs[0];
	if (!selected) {
		throw new Error("No enabled automation jobs found");
	}
	return selected;
}

function enabledCronJobs(config: LoadedConfig): CronJobConfig[] {
	return (config.automations?.jobs ?? config.cron.jobs).filter(
		(job) => job.enabled !== false,
	);
}

function resolveJobSkillPath(
	skillsRoot: string,
	overridePath: string | undefined,
	fallbackPath: string,
): string {
	if (!overridePath) {
		return fallbackPath;
	}
	return path.isAbsolute(overridePath)
		? overridePath
		: path.resolve(skillsRoot, overridePath);
}
