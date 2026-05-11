import type { PollingConfig, RunOptions } from "./types";
import type { PollingSettings } from "./workflow.types";

export function resolvePollingSettings(
	pollingConfig: PollingConfig,
	options: RunOptions,
): PollingSettings {
	return {
		enabled: options.poll === true,
		intervalMs: options.pollIntervalMs ?? pollingConfig.intervalMs,
		maxCycles: options.maxPollCycles ?? pollingConfig.maxCycles,
		exitWhenIdle: options.exitWhenIdle ?? pollingConfig.exitWhenIdle,
		staleRunTimeoutMs: pollingConfig.staleRunTimeoutMs,
	};
}

export function shouldStopPolling(
	polling: PollingSettings,
	options: RunOptions,
	cycle: number,
	totalIssues: number,
	cycleHadError = false,
): boolean {
	if (!polling.enabled || options.issueArg) {
		return true;
	}
	if (polling.maxCycles !== undefined && cycle >= polling.maxCycles) {
		return true;
	}
	if (totalIssues === 0 && polling.exitWhenIdle && !cycleHadError) {
		return true;
	}
	return false;
}

export async function sleep(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms));
}
