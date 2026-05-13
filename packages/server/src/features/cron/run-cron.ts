import { loadConfig } from "adhdai/features/config";
import { loadCronJobsFromConfig } from "./cron-config";
import { runCronJobOnce, runCronScheduler } from "./index";

interface CronRunnerArgs {
	once: boolean;
	jobId?: string;
}

function parseArgs(argv: string[]): CronRunnerArgs {
	const args = argv.slice(2);
	const once = args.includes("--once");
	const jobIndex = args.indexOf("--job");
	const jobId = jobIndex >= 0 ? args[jobIndex + 1] : undefined;
	if (jobIndex >= 0 && (!jobId || jobId.startsWith("--"))) {
		throw new Error(
			"cron runner requires --job <JOB_ID> when --job is provided",
		);
	}
	return { once, jobId };
}

export async function runCronCli(): Promise<void> {
	const parsed = parseArgs(process.argv);
	const config = await loadConfig(process.cwd());
	const jobs = await loadCronJobsFromConfig(process.cwd());
	if (parsed.once) {
		await runCronJobOnce(config, { jobId: parsed.jobId, jobs });
		return;
	}
	await runCronScheduler(config, { jobId: parsed.jobId, jobs });
}

if (import.meta.main) {
	await runCronCli();
}
