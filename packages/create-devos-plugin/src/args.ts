import type {
	DevosPluginPreset,
	DevosPluginTemplate,
	ScaffoldDevosPluginOptions,
} from "./scaffold.types";

const TEMPLATES = new Set(["skill", "mcp", "connector"]);
const PRESETS = new Set(["codegraph", "slack", "telegram"]);

export function parseScaffoldArgs(
	args: string[],
): ScaffoldDevosPluginOptions & {
	json: boolean;
} {
	const options: Partial<ScaffoldDevosPluginOptions> & { json: boolean } = {
		outputDir: process.cwd(),
		json: false,
	};
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (!arg.startsWith("--")) {
			if (options.name) throw new Error(`Unexpected argument: ${arg}`);
			options.name = arg;
			continue;
		}
		if (arg === "--force") {
			options.force = true;
			continue;
		}
		if (arg === "--json") {
			options.json = true;
			continue;
		}
		const value = args[index + 1];
		if (!value) throw new Error(`Missing value for ${arg}`);
		index += 1;
		assignOption(options, arg, value);
	}
	if (!options.name) throw new Error("Missing plugin name");
	return options as ScaffoldDevosPluginOptions & { json: boolean };
}

function assignOption(
	options: Partial<ScaffoldDevosPluginOptions>,
	arg: string,
	value: string,
): void {
	if (arg === "--template") {
		if (!TEMPLATES.has(value))
			throw new Error("--template must be skill, mcp, or connector");
		options.template = value as DevosPluginTemplate;
		return;
	}
	if (arg === "--preset") {
		if (!PRESETS.has(value))
			throw new Error("--preset must be codegraph, slack, or telegram");
		options.preset = value as DevosPluginPreset;
		return;
	}
	if (arg === "--output") {
		options.outputDir = value;
		return;
	}
	if (arg === "--display-name") {
		options.displayName = value;
		return;
	}
	if (arg === "--description") {
		options.description = value;
		return;
	}
	if (arg === "--author") {
		options.author = value;
		return;
	}
	throw new Error(`Unknown option: ${arg}`);
}
