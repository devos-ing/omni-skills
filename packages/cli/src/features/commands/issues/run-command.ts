import type { LoadedConfig } from "../../config";
import type { RunOptions } from "../../types";
import { runWorkflow } from "../../workflow/workflow";

export async function handleRunCommand(
	config: LoadedConfig,
	options: RunOptions,
): Promise<void> {
	await runWorkflow(config, options);
}
