export interface DevosPluginSkill {
	name: string;
	path: string;
	description?: string;
}

export interface DevosPluginMcpServer {
	name: string;
	command: string;
	args: string[];
	env?: Record<string, string>;
}

export interface DevosPluginCredential {
	key: string;
	label: string;
	required: boolean;
	prompt: string;
}

export interface DevosPluginCheck {
	title: string;
	command: string;
	args: string[];
}

export interface DevosPluginManifest {
	schemaVersion: 1;
	id: string;
	name: string;
	version: string;
	description: string;
	category: string;
	skills: DevosPluginSkill[];
	mcpServers: DevosPluginMcpServer[];
	credentials: DevosPluginCredential[];
	checks: DevosPluginCheck[];
}
