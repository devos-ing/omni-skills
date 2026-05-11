import type { LoadedConfig } from "../core/config";
import type { CronJobConfig, RunOptions } from "../core/types";

export interface RunCronOptions {
	jobId?: string;
}

export interface CronRuntimeState {
	readonly nextRunAtByJobId: ReadonlyMap<string, number>;
	readonly activeJobIds: ReadonlySet<string>;
}

export interface CronSchedulerDependencies {
	now?: () => Date;
	sleep?: (ms: number) => Promise<void>;
	runWorkflow?: (config: LoadedConfig, options: RunOptions) => Promise<void>;
}

export interface RunCronJobOnceOptions {
	jobId?: string;
}

export interface CronJobRunDependencies {
	runWorkflow?: (config: LoadedConfig, options: RunOptions) => Promise<void>;
}

export interface CronCycleState {
	nextRunAtByJobId: Map<string, number>;
	activeJobIds: Set<string>;
}

export interface CronCycleDeps {
	now: () => Date;
	runWorkflow: (config: LoadedConfig, options: RunOptions) => Promise<void>;
}

export type SelectCronJobsFn = (
	config: LoadedConfig,
	jobId: string | undefined,
) => CronJobConfig[];
