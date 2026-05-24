#!/usr/bin/env bun
export {
	loadDevosPluginManifest,
	parseDevosPluginManifest,
} from "./plugin-manifest";
export type {
	DevosPluginCheck,
	DevosPluginCredential,
	DevosPluginManifest,
	DevosPluginMcpServer,
	DevosPluginSkill,
} from "./plugin-manifest.types";
export { parseScaffoldArgs } from "./args";
export { normalizePluginId, scaffoldDevosPlugin } from "./scaffold";
export type {
	DevosPluginPreset,
	DevosPluginTemplate,
	ScaffoldDevosPluginOptions,
	ScaffoldDevosPluginResult,
} from "./scaffold.types";

import { parseScaffoldArgs } from "./args";
import { scaffoldDevosPlugin } from "./scaffold";

if (import.meta.main) {
	try {
		const { json, ...options } = parseScaffoldArgs(process.argv.slice(2));
		const result = await scaffoldDevosPlugin(options);
		if (json) {
			process.stdout.write(`${JSON.stringify(result, null, "\t")}\n`);
		} else {
			process.stdout.write(
				`Created ${result.pluginId} at ${result.pluginPath}\n`,
			);
			process.stdout.write(
				"Next: bun install && bun test && devos plugins install .\n",
			);
		}
	} catch (error) {
		process.stderr.write(
			`${error instanceof Error ? error.message : String(error)}\n`,
		);
		process.exitCode = 1;
	}
}
