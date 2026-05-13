import path from "node:path";
import type { LoadedConfig } from "adhdai/features/config";
import type { CronJobConfig } from "./cron.types";

export function selectCronJobs(
	jobs: CronJobConfig[],
	jobId: string | undefined,
): CronJobConfig[] {
	const enabledJobs = enabledCronJobs(jobs);
	if (!jobId) {
		return enabledJobs;
	}
	const selected = enabledJobs.find((job) => job.id === jobId);
	if (!selected) {
		throw new Error(`Automation job '${jobId}' not found or disabled`);
	}
	return [selected];
}

export function selectCronJobForImmediateRun(
	jobs: CronJobConfig[],
	jobId: string | undefined,
): CronJobConfig {
	const selectedJobs = selectCronJobs(jobs, jobId);
	const selected = selectedJobs[0];
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

function enabledCronJobs(jobs: CronJobConfig[]): CronJobConfig[] {
	return jobs.filter((job) => job.enabled !== false);
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
