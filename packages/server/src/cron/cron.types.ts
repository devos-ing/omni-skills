import type { LoadedConfig } from "adhdai/features/config";
import type { RunOptions } from "adhdai/features/types";

export type CronScheduleDayOfWeek =
	| "sun"
	| "mon"
	| "tue"
	| "wed"
	| "thu"
	| "fri"
	| "sat";

export type CronJobSchedule =
	| {
			frequency: "minute";
			every?: number;
	  }
	| {
			frequency: "hourly";
			every?: number;
			minute?: number;
	  }
	| {
			frequency: "daily";
			time: string;
	  }
	| {
			frequency: "weekly";
			dayOfWeek: CronScheduleDayOfWeek;
			time: string;
	  };

export interface CronJobSkillOverrides {
	plan?: string;
	implement?: string;
	reviewTest?: string;
	githubComment?: string;
}

export interface CronJobConfig {
	id: string;
	name?: string;
	enabled?: boolean;
	schedule: CronJobSchedule;
	run: RunOptions;
	skills?: CronJobSkillOverrides;
}

export interface CronConfig {
	jobs: CronJobConfig[];
}

export interface RunCronOptions {
	jobId?: string;
	jobs?: CronJobConfig[];
}

export interface RunCronJobOnceOptions {
	jobId?: string;
	jobs?: CronJobConfig[];
}

export interface CronRuntimeState {
	readonly nextRunAtByJobId: ReadonlyMap<string, number>;
	readonly activeJobIds: ReadonlySet<string>;
}

export interface CronCycleState {
	nextRunAtByJobId: Map<string, number>;
	activeJobIds: Set<string>;
}

export interface CronJobRunDependencies {
	runWorkflow?: (config: LoadedConfig, options: RunOptions) => Promise<void>;
}

export interface CronSchedulerDependencies extends CronJobRunDependencies {
	now?: () => Date;
	sleep?: (ms: number) => Promise<void>;
}

export interface CronCycleDeps {
	now: () => Date;
	runWorkflow: (config: LoadedConfig, options: RunOptions) => Promise<void>;
}

export type SelectCronJobsFn = (
	jobs: CronJobConfig[],
	jobId: string | undefined,
) => CronJobConfig[];
