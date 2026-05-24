import type { PromptAdapter } from "../prompts";
import type {
	InstalledDevosPlugin,
	OnboardInstanceConfig,
} from "../setup/instance-config.types";

export async function promptForMissingPluginCredentials(
	config: OnboardInstanceConfig,
	prompts: PromptAdapter,
	pluginId?: string,
): Promise<boolean> {
	let changed = false;
	for (const plugin of config.plugins?.installed ?? []) {
		if (pluginId && plugin.id !== pluginId) continue;
		if (await promptForPluginCredentials(plugin, prompts)) changed = true;
	}
	return changed;
}

async function promptForPluginCredentials(
	plugin: InstalledDevosPlugin,
	prompts: PromptAdapter,
): Promise<boolean> {
	let changed = false;
	for (const credential of plugin.manifest.credentials) {
		if (!credential.required || plugin.credentials[credential.key]) continue;
		const value = await prompts.password({
			message: credential.prompt || `Enter ${credential.label}`,
			validate: (input) =>
				input?.trim() ? undefined : `${credential.label} is required`,
		});
		plugin.credentials[credential.key] = value;
		changed = true;
	}
	return changed;
}
