import type { Command } from "commander";
import type {
	CliRuntime,
	PluginCreateCommanderOptions,
	PluginListCommanderOptions,
	PluginsCommand,
} from "../args.types";

export function registerPluginsCommand(
	program: Command,
	runtime: CliRuntime,
): void {
	const plugins = program.command("plugins").description("manage CLI plugins");
	plugins
		.command("create <NAME>")
		.option("--template <TYPE>", "skill, mcp, or connector")
		.option("--preset <PRESET>", "codegraph, slack, or telegram")
		.option("--output <DIR>", "parent directory for the plugin")
		.option("--display-name <NAME>", "human-readable plugin name")
		.option("--description <TEXT>", "plugin description")
		.option("--author <TEXT>", "plugin author")
		.option("--force", "replace an existing generated plugin directory")
		.option("--json", "print scaffold result as JSON")
		.action(
			async (
				name: string,
				options: PluginCreateCommanderOptions,
				command: Command,
			) => {
				if (
					options.template !== undefined &&
					!["skill", "mcp", "connector"].includes(options.template)
				) {
					command.error("--template must be skill, mcp, or connector");
				}
				if (
					options.preset !== undefined &&
					!["codegraph", "slack", "telegram"].includes(options.preset)
				) {
					command.error("--preset must be codegraph, slack, or telegram");
				}
				await handlePlugins(runtime, {
					action: "create",
					name,
					template: options.template,
					preset: options.preset,
					outputDir: options.output,
					displayName: options.displayName,
					description: options.description,
					author: options.author,
					force: options.force,
					json: options.json,
				});
			},
		);
	plugins
		.command("list")
		.option("--enabled", "show enabled plugins only")
		.action(async (options: PluginListCommanderOptions) => {
			await handlePlugins(runtime, {
				action: "list",
				enabledOnly: options.enabled,
			});
		});
	plugins.command("show <PLUGIN_ID>").action(async (pluginId: string) => {
		await handlePlugins(runtime, { action: "show", pluginId });
	});
	plugins.command("install <PLUGIN_ID>").action(async (pluginId: string) => {
		await handlePlugins(runtime, { action: "install", pluginId });
	});
	plugins.command("enable <PLUGIN_ID>").action(async (pluginId: string) => {
		await handlePlugins(runtime, { action: "enable", pluginId });
	});
	plugins.command("check <PLUGIN_ID>").action(async (pluginId: string) => {
		await handlePlugins(runtime, { action: "check", pluginId });
	});
}

async function handlePlugins(
	runtime: CliRuntime,
	command: PluginsCommand,
): Promise<void> {
	const config = await runtime.loadConfig();
	await runtime.handlePluginsCommand(config, command, runtime.cwd);
}
