export type PluginSourceType = "github" | "script";

export interface PluginCommandTemplate {
	command: string;
	args: string[];
}

export interface PluginCheckTemplate extends PluginCommandTemplate {
	title: string;
	expected: string;
}

export interface PluginTemplate {
	schemaVersion: 1;
	id: string;
	enabledByDefault: boolean;
	title: string;
	description: string;
	functional: string[];
	source: {
		type: PluginSourceType;
		githubRepo?: string;
		script?: string;
	};
	install: {
		kind: string;
		commands: PluginCommandTemplate[];
		notes: string[];
	};
	enable: {
		kind: string;
		config: {
			codex?: {
				plugins?: string[];
			};
		};
		notes: string[];
	};
	checks: PluginCheckTemplate[];
	tokenOptimization: {
		strategy: string;
		savingsSignal: string;
		whenToUse: string[];
	};
	maintainers: string[];
}

export type PluginsCommand =
	| {
			action: "create";
			name: string;
			template?: "skill" | "mcp" | "connector";
			preset?: "codegraph" | "slack" | "telegram";
			outputDir?: string;
			displayName?: string;
			description?: string;
			author?: string;
			force?: boolean;
			json?: boolean;
	  }
	| { action: "list"; enabledOnly?: boolean }
	| { action: "show"; pluginId: string }
	| { action: "install"; pluginId: string }
	| { action: "enable"; pluginId: string }
	| { action: "check"; pluginId: string };
