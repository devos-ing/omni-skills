import path from "node:path";
import type { LoadedConfig } from "../../../cli/src/core/config";
import type { CronJobConfig } from "../../../cli/src/core/types";

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

export function selectCronJobForImmediateRun(
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
			githubComment: resolveJobSkillPath(
				project.skills.root,
				overrides.githubComment,
				project.skills.githubComment,
			),
		},
	}));

	return {
		...config,
		projects,
	};
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
