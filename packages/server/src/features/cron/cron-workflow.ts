import type { LoadedConfig } from "adhdai/features/config";
import type { RunOptions } from "adhdai/features/types";

export async function runCronWorkflow(
	config: LoadedConfig,
	options: RunOptions,
): Promise<void> {
	const { runWorkflow } = await import("adhdai/features/workflow/workflow");
	await runWorkflow(config, options);
}
