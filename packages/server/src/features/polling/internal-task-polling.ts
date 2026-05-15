import { eq } from "drizzle-orm";
import { boardTasksTable } from "../../db";
import { normalizeError } from "../../logger";
import type {
	InternalTaskPollingScheduler,
	InternalTaskPollingSchedulerDeps,
	InternalTaskPollingSchedulerOptions,
} from "./polling.types";

const READY_STATUS = "planning";

export function startInternalTaskPollingScheduler(
	options: InternalTaskPollingSchedulerOptions,
	deps: InternalTaskPollingSchedulerDeps = {},
): InternalTaskPollingScheduler {
	const intervalMs = options.config.polling.intervalMs;
	const setIntervalFn = deps.setIntervalFn ?? setInterval;
	const clearIntervalFn = deps.clearIntervalFn ?? clearInterval;
	let stopped = false;
	let inFlight = false;

	const runTick = async (): Promise<void> => {
		if (stopped) {
			return;
		}
		if (inFlight) {
			options.logger.info(
				{ intervalMs },
				"Skipping overlapping internal task polling tick",
			);
			return;
		}

		inFlight = true;
		try {
			const tasks = await options.db
				.select()
				.from(boardTasksTable)
				.where(eq(boardTasksTable.status, READY_STATUS));
			for (const task of tasks) {
				if (!task.projectId) {
					continue;
				}
				const result = await options.cliExecutor.execute({
					action: "run",
					projectId: task.projectId,
					issueKey: task.taskKey,
				});
				if (result.status !== "succeeded") {
					options.logger.error(
						{
							taskKey: task.taskKey,
							projectId: task.projectId,
							status: result.status,
							error: result.error,
						},
						"Internal task polling command returned non-success status",
					);
				}
			}
		} catch (error) {
			options.logger.error(
				{ intervalMs, err: normalizeError(error) },
				"Internal task polling command failed",
			);
		} finally {
			inFlight = false;
		}
	};

	const intervalHandle = setIntervalFn(() => {
		void runTick();
	}, intervalMs);

	options.logger.info(
		{ intervalMs },
		"Internal task polling scheduler started",
	);
	void runTick();

	return {
		stop: () => {
			if (stopped) {
				return;
			}
			stopped = true;
			clearIntervalFn(intervalHandle);
			options.logger.info(
				{ intervalMs },
				"Internal task polling scheduler stopped",
			);
		},
	};
}
