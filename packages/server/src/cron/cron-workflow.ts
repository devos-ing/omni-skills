import type { LoadedConfig } from "../../../cli/src/core/config";
import type { RunOptions } from "../../../cli/src/core/types";

export async function runCronWorkflow(
	config: LoadedConfig,
	options: RunOptions,
): Promise<void> {
	const { runWorkflow } = await import(
		"../../../cli/src/features/workflow/workflow"
	);
	await runWorkflow(config, options);
}
