import { describe, expect, it } from "bun:test";

import {
	type CronJobConfig,
	computeNextCronRunAt,
	runCronJobOnce,
	runCronScheduler,
	selectCronJobs,
} from "adhdai-server/cron";

describe("cron boundary export", () => {
	it("exports cron runtime and type symbols through adhdai-server/cron", () => {
		expect(typeof computeNextCronRunAt).toBe("function");
		expect(typeof selectCronJobs).toBe("function");
		expect(typeof runCronScheduler).toBe("function");
		expect(typeof runCronJobOnce).toBe("function");

		const typedJob: CronJobConfig = {
			id: "job-1",
			schedule: { frequency: "minute" },
			run: {},
		};
		expect(typedJob.id).toBe("job-1");
	});
});
