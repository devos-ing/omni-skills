import type { LoadedConfig } from "../features/config";
import type { CliRuntime } from "../types/args.types";

export async function withConfig(
	runtime: CliRuntime,
	action: (config: LoadedConfig) => Promise<void>,
): Promise<void> {
	const config = await runtime.loadConfig();
	await action(config);
}
