import { runCronCli } from "../features/cron/run-cron";

if (import.meta.main) {
	await runCronCli();
}
