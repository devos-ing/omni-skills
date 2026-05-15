import type { LoadedConfig } from "devos/features/config";
import type {
	CliCommandExecutionResult,
	CliCommandRequest,
} from "devos/features/server";
import type { CliExecutor } from "../../app.types";
import type { ServerDatabase } from "../../db";
import type { ServerLogger } from "../../logger.types";

export interface LinearTaskPollingSchedulerOptions {
	config: LoadedConfig;
	cliExecutor: CliExecutor;
	logger: ServerLogger;
}

export interface LinearTaskPollingSchedulerDeps {
	setIntervalFn?: (
		handler: () => void,
		timeoutMs: number,
	) => LinearTaskPollingIntervalHandle;
	clearIntervalFn?: (handle: LinearTaskPollingIntervalHandle) => void;
}

export type LinearTaskPollingIntervalHandle = ReturnType<typeof setInterval>;

export type LinearTaskPollingCommandRequest = Extract<
	CliCommandRequest,
	{ action: "run" }
> & {
	allProjects: true;
	poll: true;
	maxPollCycles: 1;
};

export interface LinearTaskPollingScheduler {
	stop: () => void;
}

export type LinearTaskPollingCommandResult = CliCommandExecutionResult;

export interface InternalTaskPollingSchedulerOptions {
	config: LoadedConfig;
	db: ServerDatabase["db"];
	cliExecutor: CliExecutor;
	logger: ServerLogger;
}

export type InternalTaskPollingSchedulerDeps = LinearTaskPollingSchedulerDeps;
export type InternalTaskPollingIntervalHandle = LinearTaskPollingIntervalHandle;
export interface InternalTaskPollingScheduler {
	stop: () => void;
}
