import type { CommandResult } from "../../utils/shell";
import {
	loadInstanceConfig,
	saveInstanceConfig,
} from "../setup/instance-config";
import type {
	InstanceConfigLoadResult,
	OnboardInstanceConfig,
} from "../setup/instance-config.types";
import { installRuntimePlugin } from "./instance-registry";

export interface RuntimePluginCommandDeps {
	loadInstanceConfig?: (cwd: string) => Promise<InstanceConfigLoadResult>;
	saveInstanceConfig?: (config: OnboardInstanceConfig) => Promise<void>;
	runCommand?: (
		command: string,
		args: string[],
		options: { cwd: string },
	) => Promise<CommandResult>;
}

export async function installLocalRuntimePlugin(
	pluginPath: string,
	cwd: string,
	deps: RuntimePluginCommandDeps,
): Promise<void> {
	const config = await requireInstanceConfig(cwd, deps);
	const result = await installRuntimePlugin(config, pluginPath, cwd);
	await saveRuntimeInstanceConfig(config, deps);
	process.stdout.write(
		`${result.created ? "Installed" : "Updated"} plugin ${result.plugin.id}\n`,
	);
}

export async function checkRuntimePlugin(
	plugin: NonNullable<OnboardInstanceConfig["plugins"]>["installed"][number],
	commandRunner: NonNullable<RuntimePluginCommandDeps["runCommand"]>,
): Promise<void> {
	let failed = false;
	for (const server of plugin.mcpServers) {
		if (!server.command.trim()) {
			failed = true;
			process.stdout.write(`FAIL\tMCP ${server.name}\tmissing command\n`);
		}
	}
	for (const check of plugin.manifest.checks) {
		const result = await commandRunner(check.command, check.args, {
			cwd: plugin.sourcePath,
		});
		if (result.code === 0) {
			process.stdout.write(`PASS\t${check.title}\tok\n`);
			continue;
		}
		failed = true;
		process.stdout.write(
			`FAIL\t${check.title}\t${`${result.stdout}${result.stderr}`.trim()}\n`,
		);
	}
	if (failed) throw new Error(`Plugin ${plugin.id} check failed`);
}

export async function loadOptionalInstanceConfig(
	cwd: string,
	deps: RuntimePluginCommandDeps,
): Promise<OnboardInstanceConfig | undefined> {
	const result = await (deps.loadInstanceConfig ?? loadInstanceConfig)(cwd);
	return result.ok ? result.config : undefined;
}

export async function saveRuntimeInstanceConfig(
	config: OnboardInstanceConfig,
	deps: RuntimePluginCommandDeps,
): Promise<void> {
	await (deps.saveInstanceConfig ?? saveInstanceConfig)(config);
}

async function requireInstanceConfig(
	cwd: string,
	deps: RuntimePluginCommandDeps,
): Promise<OnboardInstanceConfig> {
	const result = await (deps.loadInstanceConfig ?? loadInstanceConfig)(cwd);
	if (!result.ok)
		throw new Error(`${result.message}. Run devos onboard first.`);
	return result.config;
}
